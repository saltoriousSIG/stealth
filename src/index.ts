import "dotenv/config";
import * as readline from "readline";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { success, warning, question, bot } from "./utils/chalk.js";
import { getOrchestrator } from "./orchestrator.js";

const MEMORY_DIR = join(process.cwd(), "memory");
const SETUP_MARKER = join(MEMORY_DIR, ".setup-complete");

function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

async function main() {
  const orchestrator = getOrchestrator();
  const rl = createReadline();

  // First-run setup
  if (!existsSync(SETUP_MARKER)) {
    console.log(
      bot(
        "\nWelcome! I can be anyone you want me to be.\n" +
          "Describe who you want me to be — my personality, tone, style, expertise — and I'll adapt accordingly.\n"
      )
    );

    const description = await ask(rl, question("Who do you want me to be? "));

    if (!description.trim()) {
      console.log(warning("No description provided. Using default personality."));
    } else {
      console.log(bot("\nSetting up your personalized assistant...\n"));
      await orchestrator.runSetup(description);
      console.log(success("Setup complete! Your assistant is ready.\n"));
    }

    writeFileSync(SETUP_MARKER, "", "utf-8");
  }

  // Interactive loop
  console.log(bot("Type your message, or /quit to exit.\n"));

  while (true) {
    const input = await ask(rl, question("You: "));

    if (input.trim().toLowerCase() === "/quit") {
      console.log(bot("Goodbye!"));
      rl.close();
      process.exit(0);
    }

    if (!input.trim()) continue;

    const response = await orchestrator.process(input);
    console.log(bot(`\n${response}\n`));
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
