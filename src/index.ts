import "dotenv/config";
import * as readline from "readline";
import { getOrchestrator } from "./orchestrator.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  rl.on("line", async (command) => {
    console.log(command);
    try {
    } catch (error) {
    } finally {
      rl.close();
    }
  });
}

main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
});
