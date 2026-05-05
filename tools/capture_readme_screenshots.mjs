import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173/';
const outDir = path.resolve('docs/screenshots');
const viewport = { width: 1280, height: 720 };

async function waitForGame(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(globalThis.__pixiApp?.stage?.children?.length));
  await page.waitForTimeout(1600);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
}

async function currentScene(page) {
  return page.evaluate(() => globalThis.__pixiApp.stage.children[0]?.constructor?.name ?? null);
}

async function gotoCharacterSelect(page) {
  if ((await currentScene(page)) !== 'MenuScene') return;
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => globalThis.__pixiApp.stage.children[0]?.constructor?.name === 'CharacterSelectScene');
  await page.waitForTimeout(900);
}

async function gotoBattle(page) {
  await gotoCharacterSelect(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => globalThis.__pixiApp.stage.children[0]?.constructor?.name === 'BattleScene');
  await clearCountdown(page);
  await page.waitForTimeout(700);
}

async function clearCountdown(page) {
  await page.evaluate(() => {
    const scene = globalThis.__pixiApp.stage.children[0];
    scene.countdownFrames = 0;
    if (scene.countdownText) {
      scene.removeChild(scene.countdownText);
      scene.countdownText.destroy();
      scene.countdownText = null;
    }
  });
}

async function stageHitFeedback(page) {
  await page.evaluate(() => {
    const scene = globalThis.__pixiApp.stage.children[0];
    scene.countdownFrames = 0;
    scene.p1.x = 500;
    scene.p2.x = 700;
    scene.p1.y = 520;
    scene.p2.y = 520;
    scene.p1.facing = 1;
    scene.p2.facing = -1;
    scene.p1.setForcedFrame('benchmark_swing');
    scene.p2.setForcedFrame('hit');
    const event = {
      attackerId: 'P1',
      attackerMoveSetId: 'altman',
      targetId: 'P2',
      kind: 'combo2',
      blocked: false,
      damage: 100,
      hitPoint: { x: 650, y: 285 },
    };
    scene.feedback?.ingest([event]);
    scene.spawnScreenBitmapFeedback?.([event]);
    scene.screenEffects?.shake(8, 18);
  });
  await page.waitForTimeout(260);
}

async function triggerUltimate(page, attackerId, elapsedFrames) {
  await clearCountdown(page);
  await page.evaluate(({ attackerId }) => {
    const scene = globalThis.__pixiApp.stage.children[0];
    scene.countdownFrames = 0;
    if (scene.cinematic) {
      scene.removeChild(scene.cinematic);
      scene.cinematic.destroy({ children: true });
      scene.cinematic = null;
    }
    scene.startCinematic(attackerId);
  }, { attackerId });

  await page.evaluate(async ({ elapsedFrames }) => {
    const scene = globalThis.__pixiApp.stage.children[0];
    for (let i = 0; i < elapsedFrames; i += 1) {
      scene.cinematic?.update();
      if (scene.cinematicAttackerId) {
        const attacker = scene.cinematicAttackerId === 'P1' ? scene.p1 : scene.p2;
        attacker.setForcedFrame(scene.cinematic.getCharacterPhaseKey());
      }
      scene.feedback?.update();
      scene.screenBitmapFx?.update();
    }
  }, { elapsedFrames });
  await page.waitForTimeout(160);
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
await waitForGame(page);
await screenshot(page, '01-menu.png');

await gotoCharacterSelect(page);
await screenshot(page, '02-character-select.png');

await gotoBattle(page);
await stageHitFeedback(page);
await screenshot(page, '03-hit-feedback.png');

await triggerUltimate(page, 'P1', 325);
await screenshot(page, '04-sam-ultimate.png');

await page.reload({ waitUntil: 'networkidle' });
await waitForGame(page);
await gotoCharacterSelect(page);
await page.keyboard.press('KeyD');
await page.keyboard.press('Enter');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Space');
await page.waitForFunction(() => globalThis.__pixiApp.stage.children[0]?.constructor?.name === 'BattleScene');
await clearCountdown(page);
await triggerUltimate(page, 'P1', 370);
await screenshot(page, '05-dario-ultimate.png');

await page.reload({ waitUntil: 'networkidle' });
await waitForGame(page);
await gotoCharacterSelect(page);
await page.keyboard.press('KeyD');
await page.keyboard.press('KeyD');
await page.keyboard.press('Enter');
await page.keyboard.press('Space');
await page.waitForFunction(() => globalThis.__pixiApp.stage.children[0]?.constructor?.name === 'BattleScene');
await clearCountdown(page);
await triggerUltimate(page, 'P1', 282);
await screenshot(page, '06-elon-ultimate.png');

await browser.close();
console.log(`Captured README screenshots in ${outDir}`);
