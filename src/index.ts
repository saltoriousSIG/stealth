import "dotenv/config";
import * as readline from "readline";
import { getOrchestrator } from "./orchestrator.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  rl.question("Enter your command: ", async (command) => {
    console.log(command);
    try {
    } catch (error) {
    } finally {
      rl.close();
    }
  });

  process.stdin.on("data", async (data) => {
    const command = data.toString().trim();
    console.log(command);
  });
}

main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
});
