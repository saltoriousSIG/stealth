
import 'dotenv/config';
import * as readline from 'readline';
import ora from 'ora';
import { Orchestrator } from './orchestrator.js';
import { loadConversation, saveConversation } from './memory.js';

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
  let rl = createReadline();
  const orchestrator = new Orchestrator();
  loadConversation();

  rl.close();
  const initSpinner = ora('Initializing...').start();
  await orchestrator.init();
  initSpinner.succeed('Ready');
  rl = createReadline();

  console.log('Type your message, or /quit to exit.\n');

  while (true) {
    const input = await ask(rl, 'You: ');

    if (input.trim().toLowerCase() === '/quit') {
      saveConversation();
      console.log('Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (!input.trim()) continue;

    rl.close();
    const spinner = ora('Thinking...').start();
    const response = await orchestrator.process(input);
    spinner.stop();
    rl = createReadline();

    console.log(`\nJarvis: ${response}\n`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
