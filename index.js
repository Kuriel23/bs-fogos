import { Bot, RichText } from "@skyware/bot";
import * as dotenv from "dotenv";
import { scheduleJob } from "node-schedule";
import * as process from "node:process";
import { launch } from "puppeteer";

dotenv.config();

const agent = new Bot({ langs: ["pt"] });

agent.login({
	identifier: process.env.BLUESKY_USERNAME,
	password: process.env.BLUESKY_PASSWORD,
});

function start() {
	const selector = ".leaflet-top, .leaflet-bottom";
	launch({
		defaultViewport: {
			width: 1080,
			height: 1080,
		},
	}).then(async (browser) => {
		const page = await browser.newPage();
		await page.goto("https://panorama.sipam.gov.br/painel-do-fogo/");
		await page.locator(".leaflet-control-zoom-in").click();
		await page.locator(".leaflet-control-zoom-in").click();
		await page.locator(".leaflet-control-zoom-in").click();
		await page.evaluate((sel) => {
			const elements = document.querySelectorAll(sel);
			// biome-ignore lint/complexity/noForEach: <explanation>
			elements.forEach((el) => el.parentNode.removeChild(el));
		}, `${selector}, .menu-item, #btnLegenda`);
		setTimeout(async () => {
			const fileElement = await page.waitForSelector("main");
			const fire = await fileElement.screenshot({
				optimizeForSpeed: true,
				type: "jpeg",
			});
			console.log("✅ [SCREENSHOT] • Foto das queimadas concluída");
			await page.goto("https://aqicn.org/map/brazil/pt/");
			await page.evaluate((sel) => {
				const elements = document.querySelectorAll(sel);
				// biome-ignore lint/complexity/noForEach: <explanation>
				elements.forEach((el) => el.parentNode.removeChild(el));
			}, selector);
			const fileElementIQA = await page.waitForSelector("#map_canvas");
			const iqa = await fileElementIQA.screenshot({
				type: "jpeg",
			});
			console.log("✅ [SCREENSHOT] • Foto da qualidade do ar concluída");
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
			const richText = new RichText().text(
				`[${process.env.status === "local" ? "ALPHA" : "BETA"}] - Informação das queimadas e da qualidade do ar em território brasileiro ás ${formattedTime}.`,
			);
			await agent
				.post({
					text: richText,
					images: [
						{
							alt: "Incêndios / fogos ativos no Brasil no momento da publicação.",
							data: new Blob([fire], { type: "image/jpeg" }),
							aspectRatio: {
								width: 1080,
								height: 1080,
							},
						},
						{
							alt: "Qualidade do ar no Brasil no momento da publicação.",
							data: new Blob([iqa], { type: "image/jpeg" }),
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
		}, 5000);
	});
}

console.log("✅ [GATEWAY] • Iniciado");

if (process.env.status === "local") start();
else
	scheduleJob("0 */1 * * *", async () => {
		console.log("❇️ [BOT] • Reproduzindo novo post");
		start();
	});
