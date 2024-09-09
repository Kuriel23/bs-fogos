import { Bot, RichText } from "@skyware/bot";
import axios from "axios";
import * as dotenv from "dotenv";
import { scheduleJob } from "node-schedule";
import * as process from "node:process";

dotenv.config();

const agent = new Bot({ langs: ["pt"] });

agent.login({
	identifier: process.env.BLUESKY_USERNAME,
	password: process.env.BLUESKY_PASSWORD,
});

function start() {
	
}

start();

console.log("✅ [GATEWAY] • Iniciado");

scheduleJob("0 */1 * * *", async () => {
	console.log("❇️ [GATEWAY] • Reproduzindo novo post");
	start();
});
