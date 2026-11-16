import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('loads the layout workspace and preview', async ({ page }) => {
  await expect(page.getByText('Screen planner')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stage preview' })).toBeVisible();
  await expect(page.getByText('Saved locally')).toBeVisible();
  await expect(page.getByText('1,920 × 1,080 px')).toBeVisible();
});

test('adds a screen and persists its project state', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a screen' }).click();
  await expect(page.getByRole('button', { name: 'Screen 2', exact: true })).toBeVisible();
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Screen 2', exact: true })).toBeVisible();
});

test('navigates through browser, editor, and designer workspaces', async ({ page }) => {
  await page.getByRole('tab', { name: 'Browser' }).click();
  await expect(page.getByRole('heading', { name: 'Browser' })).toBeVisible();
  await expect(page.getByText('Official Library · 5', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Editor' }).click();
  await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible();
  await expect(page.getByText('Energy', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Designer' }).click();
  await expect(page.getByText('Recipe authoring')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save recipe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Output node', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const currentNode = page.getByRole('button', { name: 'Current node', exact: true });
  await currentNode.click();
  await expect(currentNode).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.rf-preview-canvas canvas')).toBeVisible();
});

test('toggles preview masking', async ({ page }) => {
  const maskButton = page.getByRole('button', { name: 'Mask on' });
  await maskButton.click();
  await expect(page.getByRole('button', { name: 'Mask off' })).toBeVisible();
});

test('aligns parameter ports and keeps connected rows when collapsed', async ({ page }) => {
  await page.getByRole('tab', { name: 'Designer' }).click();
  await page.getByRole('button', { name: 'New recipe', exact: true }).click();
  const expand = page.getByRole('button', { name: 'Expand properties for Gradient', exact: true });
  const node = page.locator('.rf-recipe-node').filter({
    has: page.getByRole('button', { name: 'Delete Gradient', exact: true }),
  });
  const angle = node.locator('[data-handleid="param:angle"]');
  const color = node.locator('[data-handleid="param:colorA"]');
  const wire = page.locator('.rf-parameter-edge .react-flow__edge-path');

  const expectAligned = async () => {
    const offsets = await node.evaluate(element => {
      const left = element.getBoundingClientRect().left;
      return Array.from(element.querySelectorAll('.rf-param-handle'), handle => {
        const bounds = handle.getBoundingClientRect();
        return Math.abs(bounds.left + bounds.width / 2 - left);
      });
    });
    expect(Math.max(...offsets)).toBeLessThan(1);
  };
  const expectAttached = async handle => {
    await expect.poll(async () => {
      const bounds = await handle.boundingBox();
      const y = await wire.evaluate(path => {
        const end = path.getPointAtLength(path.getTotalLength());
        return new DOMPoint(end.x, end.y).matrixTransform(path.getScreenCTM()).y;
      });
      return Math.abs(y - bounds.y - bounds.height / 2);
    }).toBeLessThan(2);
  };

  await expect(angle).toBeVisible();
  await expect(color).toHaveCount(0);
  await expectAttached(angle);
  await expand.press('Enter');
  const collapse = page.getByRole('button', { name: 'Collapse properties for Gradient', exact: true });
  await expect(color).toBeVisible();
  await expectAligned();
  await expectAttached(angle);
  await collapse.press('Enter');
  await expect(angle).toBeVisible();
  await expect(color).toHaveCount(0);
  await expect(node.locator('.rf-node-param')).toHaveCount(1);
  await expectAligned();
  await expectAttached(angle);
});

test('auditions without changing a scene and carries a paused frame into Designer', async ({ page }) => {
  test.setTimeout(60_000);
  const activeScene = page.locator('.preview-scene-name');
  const originalScene = await activeScene.textContent();
  await page.getByRole('tab', { name: 'Browser' }).click();
  const originalPlaylist = await page.locator('.playlist-row.active strong').textContent();
  for (const name of ['Midnight Tide', 'Sanctuary Beams', 'Forest Contours']) {
    const card = page.getByRole('button', { name: new RegExp('^' + name) });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.preview-audition')).toHaveText('Auditioning · ' + name);
    await expect(activeScene).toHaveText(originalScene);
    await expect(page.locator('.playlist-row.active strong')).toHaveText(originalPlaylist);
  }
  await page.getByRole('button', { name: 'Back to scene preview' }).click();
  await expect(activeScene).toHaveText(originalScene);
  await expect(page.locator('.preview-audition')).toHaveCount(0);

  await page.getByRole('button', { name: /^Forest Contours/ }).click();
  await page.getByRole('button', { name: 'Apply to current scene' }).click();
  await expect(activeScene).toHaveText('Active scene · Forest Contours');
  await expect(page.locator('.playlist-row')).toHaveCount(1);
  await expect(page.locator('.preview-audition')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Editor' }).click();
  await page.locator('aside').getByRole('slider').press('End');
  await page.getByRole('button', { name: 'Pause preview' }).click();
  const playhead = page.getByRole('slider', { name: 'Preview time' });
  await playhead.press('Home');
  await playhead.press('PageUp');
  const playheadValue = await playhead.getAttribute('aria-valuenow');
  expect(Number(playheadValue)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Customize in Designer' }).click();
  await expect(page.getByText('Final output', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play preview' })).toBeVisible();
  await expect(playhead).toHaveAttribute('aria-valuenow', playheadValue);
  await page.getByRole('tab', { name: 'Editor' }).click();
  await expect(playhead).toHaveAttribute('aria-valuenow', playheadValue);
});

test('remix opens a separate playlist scene in Designer', async ({ page }) => {
  await page.getByRole('tab', { name: 'Browser' }).click();
  const original = await page.locator('.playlist-row.active strong').textContent();
  await page.getByRole('button', { name: /^Midnight Tide/ }).click();
  await page.getByRole('button', { name: 'Remix in Designer' }).click();
  await expect(page.getByRole('heading', { name: 'Midnight Tide Remix' })).toBeVisible();
  await page.getByRole('tab', { name: 'Editor' }).click();
  await expect(page.locator('.playlist-row strong')).toHaveText([original, 'Midnight Tide Remix']);
  await expect(page.locator('.playlist-row.active strong')).toHaveText('Midnight Tide Remix');
});

test('keeps scene edits independent of the library across playlist switches and reload', async ({ page }) => {
  await page.getByRole('tab', { name: 'Browser' }).click();
  await page.getByRole('button', { name: 'Add to playlist' }).click();
  const scene = page.locator('.playlist-row.active');
  const name = await scene.locator('strong').textContent();
  const savedScene = page.locator('.playlist-row').filter({ has: page.getByRole('button', { name: 'Remove ' + name + ' from playlist', exact: true }) });
  await page.getByRole('tab', { name: 'Editor' }).click();
  const energy = page.locator('aside').getByRole('slider');
  await energy.press('End');
  await expect(energy).toHaveAttribute('aria-valuenow', '100');
  await page.getByRole('button', { name: 'Add scene', exact: true }).click();
  await expect(energy).toHaveAttribute('aria-valuenow', '50');
  await savedScene.click();
  await expect(energy).toHaveAttribute('aria-valuenow', '100');
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('display-forge-react'));
    if (!state?.activeRecipeLibraryId) return null;
    const library = state.recipeLibrary.find(entry => entry.id === state.activeRecipeLibraryId);
    const scene = state.playlist.find(entry => entry.id === state.selectedScene);
    return [scene?.recipeDocument.controls.energy, library?.recipeDocument.controls.energy === 100];
  })).toEqual([100, false]);
  await page.reload();
  await page.getByRole('tab', { name: 'Editor' }).click();
  await expect(energy).toHaveAttribute('aria-valuenow', '100');
});
