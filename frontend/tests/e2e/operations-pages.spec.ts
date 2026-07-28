import { expect, test, type Page, type TestInfo } from "@playwright/test";

const isMobileProject = (testInfo: TestInfo) => testInfo.project.name.includes("mobile");

const gotoPreviewRoute = async (page: Page, hashRoute: string, readyTestId: string) => {
  const joiner = hashRoute.includes("?") ? "&" : "?";
  await page.goto(`/#${hashRoute}${joiner}preview=1`);
  await expect(page.getByTestId(readyTestId)).toBeVisible({ timeout: 30_000 });
};

const parseCompactNumber = (value: string) => {
  const digits = value.replace(/[^\d.-]/g, "");
  return Number(digits);
};

test("control desktop preview supports target switch and command flow", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");
  await page.setViewportSize({ width: 2000, height: 900 });

  await gotoPreviewRoute(page, "/control", "control-console");

  await expect(page.getByTestId("control-summary-title")).toHaveText(/Host Shell/);

  await page.getByTestId("control-target-card-home-daemon-a-instance-paper-lobby").click();
  await expect(page.getByTestId("control-summary-title")).toHaveText("Lobby");

  const commandInput = page.getByTestId("control-command-input");
  await commandInput.fill("list");
  await page.getByTestId("control-command-send").click();

  const terminal = page.getByTestId("control-terminal-body");
  await expect(terminal).toContainText("$ list");
  await expect(terminal).toContainText("[Lobby] command accepted: list");

  await page.getByTestId("control-actions-slot").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("control-actions-desktop")).toBeInViewport();

  const actionButtons = ["start", "restart", "stop", "terminate"].map((action) =>
    page.getByTestId(`control-action-${action}`)
  );
  const actionButtonBoxes = await Promise.all(actionButtons.map((button) => button.boundingBox()));
  expect(actionButtonBoxes.every(Boolean)).toBe(true);
  const actionButtonTops = actionButtonBoxes.map((box) => box?.y ?? 0);
  expect(Math.max(...actionButtonTops) - Math.min(...actionButtonTops)).toBeLessThanOrEqual(1);

  await page.getByTestId("control-action-stop").click();
  const stopConfirmDialog = page.locator(".ant-modal-confirm");
  await expect(stopConfirmDialog).toContainText(/确认停止当前实例|Stop Instance|Are you sure/);
  await stopConfirmDialog.getByRole("button", { name: /停止实例|Stop Instance/ }).click();
  await expect(terminal).toContainText("[instance] Lobby stopped.");

  await page.getByTestId("control-action-start").click();
  await expect(terminal).toContainText("[instance] Lobby is now running.");
});

test("control target statuses stay distinct in light and dark themes", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/control", "control-console");

  const runningStatus = page.getByTestId(
    "control-target-status-home-daemon-a-instance-paper-lobby"
  );
  const startingStatus = page.getByTestId(
    "control-target-status-home-daemon-a-instance-survival-main"
  );
  const stoppedStatus = page.getByTestId(
    "control-target-status-home-daemon-a-instance-proxy-gate"
  );
  const offlineStatus = page.getByTestId(
    "control-target-status-backup-daemon-c-instance-backup-world"
  );
  const runningCard = page.getByTestId(
    "control-target-card-home-daemon-a-instance-paper-lobby"
  );
  const summaryMetaItem = page.locator(".control-console__summary-meta-item").first();
  const metricCard = page.locator(".control-console__metric-card").first();
  const parseColor = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
  const relativeLuminance = (color: string) => {
    const channels = parseColor(color).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrastRatio = (foreground: string, background: string) => {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    return (
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
    );
  };

  for (const theme of [
    { storageValue: "1", bodyClass: "app-light-theme" },
    { storageValue: "2", bodyClass: "app-dark-theme" }
  ]) {
    await page.evaluate(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: "THEME_KEY", value: theme.storageValue }
    );
    await page.reload();
    await expect(page.getByTestId("control-console")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("body")).toHaveClass(new RegExp(theme.bodyClass));

    await expect(runningStatus).toHaveAttribute("data-status-tone", "success");
    await expect(startingStatus).toHaveAttribute("data-status-tone", "processing");
    await expect(stoppedStatus).toHaveAttribute("data-status-tone", "error");
    await expect(offlineStatus).toHaveAttribute("data-status-tone", "default");

    const [runningColor, stoppedColor, offlineColor] = await Promise.all(
      [runningStatus, stoppedStatus, offlineStatus].map((status) =>
        status.evaluate((element) => window.getComputedStyle(element).color)
      )
    );
    const [runningRed, runningGreen] = parseColor(runningColor);
    const [stoppedRed, stoppedGreen] = parseColor(stoppedColor);
    const cardColors = await runningCard.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { background: style.backgroundColor, foreground: style.color };
    });
    const summaryColors = await summaryMetaItem.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { background: style.backgroundColor, foreground: style.color };
    });
    const metricColors = await metricCard.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { background: style.backgroundColor, foreground: style.color };
    });

    expect(runningGreen).toBeGreaterThan(runningRed);
    expect(stoppedRed).toBeGreaterThan(stoppedGreen);
    expect(new Set([runningColor, stoppedColor, offlineColor]).size).toBe(3);
    expect(contrastRatio(cardColors.foreground, cardColors.background)).toBeGreaterThan(4.5);
    expect(contrastRatio(summaryColors.foreground, summaryColors.background)).toBeGreaterThan(4.5);
    expect(contrastRatio(metricColors.foreground, metricColors.background)).toBeGreaterThan(4.5);
  }
});

test("control desktop preview brings favorite instances to the front", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/control", "control-console");

  const lobbyCard = page.getByTestId("control-target-card-home-daemon-a-instance-paper-lobby");
  const survivalCard = page.getByTestId("control-target-card-home-daemon-a-instance-survival-main");
  const favoriteButton = page.getByTestId("control-target-favorite-home-daemon-a-instance-survival-main");

  const beforeLobbyBox = await lobbyCard.boundingBox();
  const beforeSurvivalBox = await survivalCard.boundingBox();
  expect(beforeLobbyBox).not.toBeNull();
  expect(beforeSurvivalBox).not.toBeNull();

  if (beforeLobbyBox && beforeSurvivalBox) {
    expect(beforeSurvivalBox.y).toBeGreaterThan(beforeLobbyBox.y);
  }

  await favoriteButton.click();

  await expect
    .poll(async () => {
      const lobbyBox = await lobbyCard.boundingBox();
      const survivalBox = await survivalCard.boundingBox();
      if (!lobbyBox || !survivalBox) return false;
      return survivalBox.y < lobbyBox.y;
    })
    .toBe(true);
});

test("control desktop preview keeps offline targets in explicit error state", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/control", "control-console");

  await page.getByTestId("control-target-filter").click();
  await page.locator(".ant-select-dropdown").last().getByText("备份节点 C").click();
  await page.getByTestId("control-target-card-backup-daemon-c-instance-backup-world").click();
  await expect(page.getByTestId("control-summary-title")).toHaveText("Backup World");

  const commandInput = page.getByTestId("control-command-input");
  const commandSend = page.getByTestId("control-command-send");
  const terminal = page.getByTestId("control-terminal-body");
  const startAction = page.getByTestId("control-action-start");

  await expect(commandInput).toBeDisabled();
  await expect(commandSend).toBeDisabled();
  await expect(startAction).toBeDisabled();
  await expect(terminal).toContainText("节点离线，当前仅展示样式预览状态。");
});

test("control desktop preview opens GM player operations modal from summary players", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/control", "control-console");
  await page.getByTestId("control-target-card-home-daemon-a-instance-survival-main").click();

  await expect(page.getByTestId("control-online-players")).toBeVisible();
  await page.getByTestId("control-online-player-preview-player-1").click();

  await expect(page.getByTestId("control-player-modal")).toBeVisible();
  await expect(page.getByTestId("gm-operations-panel")).toBeVisible();
  await expect(page.getByTestId("gm-inventory-section")).toBeVisible();
  await expect(page.getByTestId("gm-inventory-refresh")).toBeVisible();
});

test("control desktop preview supports terminate action with confirmation", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/control", "control-console");
  await page.getByTestId("control-target-card-home-daemon-a-instance-paper-lobby").click();

  await page.getByTestId("control-action-terminate").click();

  const confirmDialog = page.locator(".ant-modal-confirm");
  await expect(confirmDialog).toContainText(/FINAL CONFIRMATION|二次确认/);
  await expect(confirmDialog).toContainText(/forcefully terminate|强制终止运行实例/);
  await confirmDialog.getByRole("button", { name: /终止|Terminate/ }).click();

  await expect(page.getByTestId("control-terminal-body")).toContainText("[instance] Lobby terminated.");
});

test("control mobile preview opens selector drawer and navigates with bottom nav", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), "移动端链路仅在移动项目执行");

  await gotoPreviewRoute(page, "/control", "control-console");

  await expect(page.getByTestId("operations-mobile-nav")).toBeVisible();
  await expect(page.getByTestId("control-actions-mobile")).toBeVisible();

  await page.getByTestId("control-mobile-switcher").click();
  await expect(page.getByTestId("control-target-selector-drawer")).toBeVisible();

  await page.getByTestId("control-target-filter").click();
  await page.locator(".ant-select-dropdown").last().getByText("客厅 NAS B").click();
  await page.getByTestId("control-target-card-nas-daemon-b-instance-creative-test").click();
  await expect(page.getByTestId("control-summary-title")).toHaveText("Creative Test");

  await page.getByTestId("mobile-nav-item-players").click();
  await expect(page.getByTestId("gm-console")).toHaveAttribute("data-page-mode", "manage");
});

test("players desktop preview remains available as standalone page", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/players", "players-console");
  await expect(page.getByTestId("players-console")).toContainText(/玩家互动|Players/);
  await expect(page.getByTestId("gm-console")).toHaveCount(0);
});

test("gm desktop preview supports player selection and economy action", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/gm", "gm-console");
  await expect(page.getByTestId("gm-console")).toHaveAttribute("data-page-mode", "manage");

  await page.getByTestId("gm-player-card-relay-home-a-survival-main-preview-player-1").click();
  await expect(page.getByTestId("gm-operations-panel")).toBeVisible();

  const balanceLocator = page.getByTestId("gm-economy-balance");
  const before = parseCompactNumber((await balanceLocator.textContent()) || "0");

  await page.getByTestId("gm-economy-amount").fill("2000");
  await page.getByTestId("gm-economy-deposit").click();

  await expect(page.getByTestId("gm-last-action-result")).toBeVisible();
  await expect(page.getByTestId("gm-last-action-result")).toContainText("2000");

  await expect
    .poll(async () => {
      const afterText = (await balanceLocator.textContent()) || "0";
      return parseCompactNumber(afterText);
    })
    .toBe(before + 2000);
});

test("gm desktop preview asks confirmation before risky action", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/gm", "gm-console");
  await page.getByTestId("gm-player-card-relay-home-a-survival-main-preview-player-1").click();
  await expect(page.getByTestId("gm-operations-panel")).toBeVisible();

  const balanceLocator = page.getByTestId("gm-economy-balance");
  const before = parseCompactNumber((await balanceLocator.textContent()) || "0");

  await page.getByTestId("gm-economy-amount").fill("500");
  await page.getByTestId("gm-economy-withdraw").click();

  const confirmDialog = page.locator(".ant-modal-confirm");
  await expect(confirmDialog.getByText("确认扣金币")).toBeVisible();
  await confirmDialog.getByRole("button", { name: /取\s*消/ }).click();
  await expect(confirmDialog).toBeHidden();
  await expect(page.getByTestId("gm-last-action-result")).toHaveCount(0);

  await page.getByTestId("gm-economy-withdraw").click();
  await confirmDialog.getByRole("button", { name: /确认执行/ }).click();

  await expect(page.getByTestId("gm-last-action-result")).toBeVisible();
  await expect(page.getByTestId("gm-last-action-result")).toContainText("500");

  await expect
    .poll(async () => {
      const afterText = (await balanceLocator.textContent()) || "0";
      return parseCompactNumber(afterText);
    })
    .toBe(before - 500);
});

test("gm desktop preview surfaces action errors without leaving stale success state", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/gm", "gm-console");
  await page.getByTestId("gm-player-card-relay-home-a-survival-main-preview-player-1").click();
  await expect(page.getByTestId("gm-operations-panel")).toBeVisible();

  await page.getByTestId("gm-temp-permission-node").fill("chat.preview.invalid");
  await page.getByTestId("gm-temp-permission-duration").fill("oops");
  await page.getByTestId("gm-temp-permission-add").click();

  await expect(page.getByTestId("gm-error-alert")).toContainText("临时权限时长格式无效。");
  await expect(page.getByTestId("gm-last-action-result")).toContainText("临时权限时长格式无效。");
});

test("gm chat mobile preview keeps chat panel within viewport and supports nav switching", async ({ page }, testInfo) => {
  test.skip(!isMobileProject(testInfo), "移动端链路仅在移动项目执行");

  await gotoPreviewRoute(page, "/gm/chat", "gm-console");
  await expect(page.getByTestId("gm-console")).toHaveAttribute("data-page-mode", "chat");
  await expect(page.getByTestId("operations-mobile-nav")).toBeVisible();

  const panel = page.getByTestId("gm-chat-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("gm-chat-message").first()).toBeVisible();

  const viewport = page.viewportSize();
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (panelBox && viewport) {
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width + 1);
  }

  const bubble = page.locator(".gm-console__message-bubble").first();
  const bubbleBox = await bubble.boundingBox();
  expect(bubbleBox).not.toBeNull();
  if (bubbleBox && viewport) {
    expect(bubbleBox.x + bubbleBox.width).toBeLessThanOrEqual(viewport.width + 1);
  }

  await page.getByTestId("mobile-nav-item-control").click();
  await expect(page.getByTestId("control-console")).toBeVisible();
});
