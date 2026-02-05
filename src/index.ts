import "dotenv/config";
import * as readline from "readline";
import { error, success, warning, question } from "./utils/chalk.js";
import { getOrchestrator } from "./orchestrator.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function collectInput(prompt: string) {
  rl.question(question(prompt), async (command) => {
    try {
      console.log(command);
    } catch (error) {}
  });
}

async function main() {
  console.log(
    "Welcome! My name is JARVIS, your AI assistant, but I can be anyone, or anything, you want me to be."
  );
  collectInput("Enter your command: ");
}

main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
});
