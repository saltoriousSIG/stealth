
import 'dotenv/config';
import * as readline from 'readline';
import ora from 'ora';
import { Orchestrator } from './orchestrator.js';
import { loadConversation, saveConversation } from './memory.js';
import { header, bot, muted, dim, accent, prompt as promptStyle, success, error } from './utils/chalk.js';

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

async function runBirth(rl: readline.Interface, orchestrator: Orchestrator): Promise<void> {
  console.log();
  console.log(header('  First time? Let\'s get you set up.'));
  console.log();
  console.log(dim('  Describe who you want me to be — personality, tone, purpose.'));
  console.log(dim('  I\'ll shape myself around what you tell me.'));
  console.log();

  const description = await ask(rl, promptStyle('  > '));

  if (!description.trim()) {
    console.log(muted('\n  No description given. Using defaults.\n'));
    return;
  }

  rl.close();
  const spinner = ora({ text: accent('Becoming...'), spinner: 'dots' }).start();
  const greeting = await orchestrator.birthAgent(description);
  spinner.stop();
  rl = createReadline();

  console.log();
  console.log(bot(`  ${greeting}`));
  console.log();
}

async function main() {
  let rl = createReadline();
  const orchestrator = new Orchestrator();
  loadConversation();

  rl.close();
  const initSpinner = ora({ text: dim('Initializing...'), spinner: 'dots' }).start();
  await orchestrator.init();
  initSpinner.succeed(success('Ready'));
  rl = createReadline();

  if (orchestrator.isFirstRun()) {
    await runBirth(rl, orchestrator);
    rl = createReadline();
  } else {
    console.log(dim('\n  Welcome back.\n'));
  }

  console.log(muted('  Type your message, or /quit to exit.\n'));

  while (true) {
    const input = await ask(rl, promptStyle('You: '));

    if (input.trim().toLowerCase() === '/quit') {
      saveConversation();
      console.log(dim('\n  Goodbye.\n'));
      rl.close();
      process.exit(0);
    }

    if (!input.trim()) continue;

    rl.close();
    const spinner = ora({ text: accent('Thinking...'), spinner: 'dots' }).start();
    const response = await orchestrator.process(input);
    spinner.stop();
    rl = createReadline();

    console.log(`\n${bot('Jarvis:')} ${response}\n`);
  }
}

main().catch((err) => {
  console.error(error('Error:'), err);
  process.exit(1);
});
