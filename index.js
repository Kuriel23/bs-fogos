import { Bot, RichText } from "@skyware/bot";
import * as dotenv from "dotenv";
import { scheduleJob } from "node-schedule";
import * as process from "node:process";
import { launch } from "puppeteer";
import get from "superagent";

dotenv.config();

const agent = new Bot({ langs: ["pt"] });

agent.login({
	identifier: process.env.BLUESKY_USERNAME,
	password: process.env.BLUESKY_PASSWORD,
});

function start() {
	launch({
		headless: false,
		ignoreHTTPSErrors: true,
		defaultViewport: null,
		ignoreDefaultArgs: ["--enable-automation"],
		args: [
			"--disable-infobars",
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-gpu=False",
			"--enable-webgl",
			"--window-size=1080,1080",
			"--start-maximized",
		],
		timeout: 10_000, // 10 seconds
		protocolTimeout: 20_000,
	}).then(async (browser) => {
		const page = await browser.newPage();
		await page.goto(
			"https://www.iqair.com/air-quality-map?lat=-15.7877770246&lng=-53.0978311267&zoomLevel=5",
		);
		await page.locator(".map-dialog__toggle-wrapper").click();
		await page.evaluate((sel) => {
			const elements = document.querySelectorAll(sel);
			// biome-ignore lint/complexity/noForEach: <explanation>
			elements.forEach((el) => el.parentNode.removeChild(el));
		}, ".bottom-left-block, .map-controls-wrapper, .top-right-block, .map-dialog__toggle-wrapper");
		setTimeout(async () => {
			const fileElement = await page.waitForSelector("#mapDiv");
			const fire = await fileElement.screenshot({
				optimizeForSpeed: true,
				type: "jpeg",
			});
			console.log("✅ [SCREENSHOT] • Foto concluída");
			await browser.close();
			const formattedTime = new Date().toLocaleString("pt-BR", {
				hour12: false,
				timeZone: "America/Sao_Paulo",
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
			get(
				`https://panorama.sipam.gov.br/painel-do-fogo/backend/classes/chart/get_eventos_painel_indicadores.php?estado=&codigo_pais=BRA&tipo_terra=&biomas=&cobertura=&data_ini=${new Date(new Date().setDate(new Date().getDate() - 1)).toISOString().split("T")[0]}&data_fim=${new Date().toISOString().split("T")[0]}`,
			).end(async (err, res) => {
				if (err) return;
				const richText = new RichText().text(
					`[${process.env.status === "local" ? "ALPHA" : "BETA"}] - Informação das queimadas e da qualidade do ar em território brasileiro ás ${formattedTime}.\n\nCertos destaques de incêndios:\n${res.body.dadosEstados
						.sort((a, b) => {
							b.quantidade - a.quantidade;
						})
						.slice(0, 5)
						.map((data) => {
							return `${data.sigla_uf} - ${data.quantidade} eventos`;
						})
						.join("\n")}`,
				);
				await agent
					.post({
						text: richText,
						images: [
							{
								alt: "Incêndios / fogos ativos e qualidade do ar no Brasil no momento da publicação.",
								data: new Blob([fire], { type: "image/jpeg" }),
								aspectRatio: {
									width: 1080,
									height: 1080,
								},
							},
						],
					})
					.then(async (post) => {
						post.like();
						console.log("✅ [BOT] • Post publicado");
					});
			});
		}, 5000);
	});
}

console.log("✅ [GATEWAY] • Iniciado");

if (process.env.status === "local") start();
else
	scheduleJob("0 */6 * * *", async () => {
		console.log("❇️ [BOT] • Reproduzindo novo post");
		start();
	});
