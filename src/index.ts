
import 'dotenv/config';
import * as readline from 'readline';
import ora from 'ora';
import { Orchestrator } from './orchestrator.js';
import { loadConversation, saveConversation } from './memory.js';
import { header, bot, muted, dim, accent, prompt as promptStyle, success, error } from './utils/chalk.js';

let rl: readline.Interface;

function createReadline(): readline.Interface {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return rl;
}

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

function spin(text: string): ReturnType<typeof ora> {
  rl.pause();
  return ora({ text, spinner: 'dots', stream: process.stderr }).start();
}

function stopSpin(spinner: ReturnType<typeof ora>, succeedText?: string): void {
  if (succeedText) {
    spinner.succeed(succeedText);
  } else {
    spinner.stop();
  }
  rl.resume();
}

async function runBirth(orchestrator: Orchestrator): Promise<void> {
  console.log();
  console.log(header('  First time? Let\'s get you set up.'));
  console.log();
  console.log(dim('  Describe who you want me to be — personality, tone, purpose.'));
  console.log(dim('  I\'ll shape myself around what you tell me.'));
  console.log();

  const description = await ask(promptStyle('  > '));

  if (!description.trim()) {
    console.log(muted('\n  No description given. Using defaults.\n'));
    return;
  }

  const spinner = spin(accent('Becoming...'));
  const greeting = await orchestrator.birthAgent(description);
  stopSpin(spinner);

  console.log();
  console.log(`  ${bot(greeting)}`);
  console.log();
}

async function main() {
  createReadline();
  const orchestrator = new Orchestrator();
  loadConversation();

  const initSpinner = spin(dim('Initializing...'));
  await orchestrator.init();
  stopSpin(initSpinner, success('Ready'));

  if (orchestrator.isFirstRun()) {
    await runBirth(orchestrator);
  } else {
    console.log(dim('\n  Welcome back.\n'));
  }

  console.log(muted('  Type your message, or /quit to exit.\n'));

  while (true) {
    const input = await ask(promptStyle('You: '));

    if (input.trim().toLowerCase() === '/quit') {
      saveConversation();
      console.log(dim('\n  Goodbye.\n'));
      rl.close();
      process.exit(0);
    }

    if (!input.trim()) continue;

    const spinner = spin(accent('Thinking...'));
    const response = await orchestrator.process(input);
    stopSpin(spinner);

    console.log(`\n${bot('Jarvis:')} ${response}\n`);
  }
}

main().catch((err) => {
  console.error(error('Error:'), err);
  process.exit(1);
});
