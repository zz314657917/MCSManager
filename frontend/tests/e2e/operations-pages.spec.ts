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

const parseRgb = (color: string) => color.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];

const relativeLuminance = (color: string) => {
  const channels = parseRgb(color).map((channel) => {
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

test("control desktop preview uses the remaining viewport height for the terminal", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面布局仅在桌面项目执行");
  await page.setViewportSize({ width: 2000, height: 900 });

  await gotoPreviewRoute(page, "/control", "control-console");

  const workspace = page.locator(".control-console__workspace");
  const terminalPanel = page.getByTestId("control-terminal-panel");
  const actionsPanel = page.getByTestId("control-actions-desktop");
  const [workspaceBox, terminalBox, actionsBox] = await Promise.all([
    workspace.boundingBox(),
    terminalPanel.boundingBox(),
    actionsPanel.boundingBox()
  ]);

  expect(workspaceBox).not.toBeNull();
  expect(terminalBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();

  if (workspaceBox && terminalBox && actionsBox) {
    expect(actionsBox.y).toBeGreaterThan(terminalBox.y + terminalBox.height);
    expect(Math.abs(workspaceBox.y + workspaceBox.height - (actionsBox.y + actionsBox.height))).toBeLessThanOrEqual(2);
  }
});

test("control desktop uses target tabs instead of a duplicate toolbar", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面布局仅在桌面项目执行");
  await page.setViewportSize({ width: 2000, height: 900 });

  await gotoPreviewRoute(page, "/control", "control-console");

  await expect(page.locator(".control-console__desktop-toolbar")).toHaveCount(0);
  await expect(page.getByTestId("control-target-tabs")).toBeVisible();
  await expect(page.getByTestId("control-target-tab-home-daemon-a-global-global0001")).toContainText("Host Shell");
});

test("control target list header does not duplicate the batch selection count", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面布局仅在桌面项目执行");

  await gotoPreviewRoute(page, "/control", "control-console");

  const targetSelector = page.getByTestId("control-target-selector");
  const headerTags = targetSelector.locator(".control-panel__header .ant-tag");
  await expect(headerTags).toHaveCount(1);

  await targetSelector.locator(".control-target-selector__batch-checkbox").first().click();
  await expect(headerTags).toHaveCount(1);
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
    const [runningRed, runningGreen] = parseRgb(runningColor);
    const [stoppedRed, stoppedGreen] = parseRgb(stoppedColor);
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

test("operations views use readable light and dark surfaces", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面主题检查仅在桌面项目执行");

  const pages = [
    { path: "/gm/chat", readyTestId: "gm-console", panel: ".gm-console__chat-panel" },
    { path: "/gm", readyTestId: "gm-console", panel: ".gm-console__summary-card" },
    { path: "/economy", readyTestId: "economy-console", panel: ".economy-console__metric" },
    { path: "/players", readyTestId: "players-console", panel: ".player-panel" }
  ];

  for (const theme of [
    { storageValue: "1", bodyClass: "app-light-theme", isDark: false },
    { storageValue: "2", bodyClass: "app-dark-theme", isDark: true }
  ]) {
    for (const item of pages) {
      await gotoPreviewRoute(page, item.path, item.readyTestId);
      await page.evaluate(
        ({ key, value }) => window.localStorage.setItem(key, value),
        { key: "THEME_KEY", value: theme.storageValue }
      );
      await page.reload();
      await expect(page.getByTestId(item.readyTestId)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("body")).toHaveClass(new RegExp(theme.bodyClass));

      const panel = page.locator(item.panel).first();
      const colors = await panel.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return { background: style.backgroundColor, foreground: style.color };
      });
      const backgroundLuminance = relativeLuminance(colors.background);

      expect(theme.isDark ? backgroundLuminance : 1 - backgroundLuminance).toBeLessThan(0.25);
      expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThan(4.5);
    }
  }
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

test("gm merged desktop view keeps selection while switching internal workspaces", async ({
  page
}, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/gm", "gm-console");

  const headerRoutes = page.locator(".app-header-content > nav.btns > .nav-button");
  await expect(headerRoutes.filter({ hasText: /GM 管理|GM Management/ })).toHaveCount(1);
  await expect(headerRoutes.filter({ hasText: /^(聊天|Chat)$/ })).toHaveCount(0);

  const selectedPlayer = page.getByTestId(
    "gm-player-card-relay-home-a-survival-main-preview-player-1"
  );
  await selectedPlayer.click();
  await expect(selectedPlayer).toHaveClass(/(?:^|\s)is-active(?:\s|$)/);

  const viewSwitch = page.getByTestId("gm-view-switch");
  await viewSwitch.locator("label.ant-segmented-item").filter({ hasText: "聊天" }).click();

  await expect(page.getByTestId("gm-console")).toHaveAttribute("data-page-mode", "chat");
  await expect(page.getByTestId("gm-chat-panel")).toBeVisible();
  await expect(page.locator(".gm-console__operations")).toHaveCount(0);
  await expect(selectedPlayer).toHaveClass(/(?:^|\s)is-active(?:\s|$)/);
  await expect(page.getByTestId("gm-chat-target")).toContainText("私聊 爱马仕");
  await expect
    .poll(() => page.evaluate(() => new URLSearchParams(location.hash.split("?")[1]).get("view")))
    .toBe("chat");

  await viewSwitch.locator("label.ant-segmented-item").filter({ hasText: "玩家操作" }).click();

  await expect(page.getByTestId("gm-console")).toHaveAttribute("data-page-mode", "manage");
  await expect(page.getByTestId("gm-operations-panel")).toBeVisible();
  await expect(page.getByTestId("gm-chat-panel")).toHaveCount(0);
  await expect(selectedPlayer).toHaveClass(/(?:^|\s)is-active(?:\s|$)/);
  await expect
    .poll(() => page.evaluate(() => new URLSearchParams(location.hash.split("?")[1]).get("view")))
    .toBeNull();
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
  await expect(page.getByTestId("mobile-nav-item-chat")).toHaveCount(0);

  const bottomNavItems = ["control", "players", "economy"].map((key) =>
    page.getByTestId(`mobile-nav-item-${key}`)
  );
  const bottomNavBoxes = await Promise.all(bottomNavItems.map((item) => item.boundingBox()));
  expect(bottomNavBoxes.every(Boolean)).toBe(true);
  const bottomNavWidths = bottomNavBoxes.map((box) => box?.width ?? 0);
  expect(Math.max(...bottomNavWidths) - Math.min(...bottomNavWidths)).toBeLessThanOrEqual(1);

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

  const viewSwitch = page.getByTestId("gm-view-switch");
  await viewSwitch.locator("label.ant-segmented-item").filter({ hasText: "玩家操作" }).click();
  await expect(page.getByTestId("gm-console")).toHaveAttribute("data-page-mode", "manage");
  await expect(page.getByTestId("gm-mobile-player-panel")).toBeVisible();
  await expect(page.getByTestId("gm-chat-panel")).toHaveCount(0);

  await viewSwitch.locator("label.ant-segmented-item").filter({ hasText: "聊天" }).click();
  await expect(page.getByTestId("gm-console")).toHaveAttribute("data-page-mode", "chat");
  await expect(page.getByTestId("gm-chat-panel")).toBeVisible();

  await page.getByTestId("mobile-nav-item-control").click();
  await expect(page.getByTestId("control-console")).toBeVisible();
});

test("gm desktop preview supports player kick and ban actions", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/gm", "gm-console");
  await page.getByTestId("gm-player-card-relay-home-a-survival-main-preview-player-1").click();
  await page.getByTestId("gm-action-section-select").click();
  await page.locator(".ant-select-dropdown").last().getByText("封禁 / 踢出").click();

  await page.getByTestId("gm-player-kick").click();
  const confirmDialog = page.locator(".ant-modal-confirm");
  await expect(confirmDialog.getByText("确认踢出玩家")).toBeVisible();
  await confirmDialog.getByRole("button", { name: /确认执行/ }).click();
  await expect(page.getByTestId("gm-last-action-result")).toContainText("踢出");
});

test("gm chat desktop preview uses a bounded chat-first layout", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面布局仅在桌面项目执行");
  await page.setViewportSize({ width: 2048, height: 1152 });

  await gotoPreviewRoute(page, "/gm/chat", "gm-console");
  await expect(page.getByTestId("gm-console")).toHaveAttribute("data-page-mode", "chat");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const [path, query = ""] = location.hash.slice(1).split("?");
        return {
          path,
          preview: new URLSearchParams(query).get("preview"),
          view: new URLSearchParams(query).get("view")
        };
      })
    )
    .toEqual({ path: "/gm", preview: "1", view: "chat" });
  await expect(page.locator(".gm-console__summary-card")).toHaveCount(0);
  await expect(page.locator(".gm-console__operations")).toHaveCount(0);
  await expect(page.getByTestId("gm-server-search")).toBeVisible();
  await expect(page.getByTestId("gm-player-search")).toBeVisible();
  await expect(page.getByTestId("gm-player-card-relay-home-a-survival-main-preview-player-1")).toBeVisible();

  const layout = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="gm-chat-panel"]');
    const body = document.querySelector<HTMLElement>('[data-testid="gm-chat-body"]');
    const workspace = document.querySelector<HTMLElement>(".gm-console__workspace");
    const serverSection = document.querySelector<HTMLElement>(".gm-sidebar__section--servers");
    const playerSection = document.querySelector<HTMLElement>(".gm-sidebar__section--players");
    const sidebarServerList = document.querySelector<HTMLElement>(".gm-sidebar__server-list");
    const sidebarPlayerList = document.querySelector<HTMLElement>(".gm-sidebar__player-list");

    if (
      !panel ||
      !body ||
      !workspace ||
      !serverSection ||
      !playerSection ||
      !sidebarServerList ||
      !sidebarPlayerList
    ) {
      return undefined;
    }

    const panelRect = panel.getBoundingClientRect();
    const serverSectionRect = serverSection.getBoundingClientRect();
    const playerSectionRect = playerSection.getBoundingClientRect();
    const bodyStyle = window.getComputedStyle(body);
    const serverListStyle = window.getComputedStyle(sidebarServerList);
    const playerListStyle = window.getComputedStyle(sidebarPlayerList);

    return {
      panelBottom: panelRect.bottom,
      panelHeight: panelRect.height,
      viewportHeight: window.innerHeight,
      bodyHeight: body.clientHeight,
      bodyOverflowY: bodyStyle.overflowY,
      workspaceColumns: window.getComputedStyle(workspace).gridTemplateColumns,
      serverSectionHeight: serverSectionRect.height,
      playerSectionHeight: playerSectionRect.height,
      serverListOverflowY: serverListStyle.overflowY,
      playerListOverflowY: playerListStyle.overflowY
    };
  });

  expect(layout).toBeDefined();
  expect(layout?.panelBottom).toBeLessThanOrEqual((layout?.viewportHeight || 0) + 1);
  expect(layout?.panelHeight).toBeGreaterThan(500);
  expect(layout?.bodyHeight).toBeGreaterThan(300);
  expect(layout?.bodyOverflowY).toBe("auto");
  expect(layout?.serverListOverflowY).toBe("auto");
  expect(layout?.playerListOverflowY).toBe("auto");
  expect(Math.abs((layout?.serverSectionHeight || 0) - (layout?.playerSectionHeight || 0))).toBeLessThanOrEqual(1);
  expect(layout?.workspaceColumns.trim().split(" ").length).toBe(1);

  await page.getByTestId("gm-server-search").fill("归档");
  await expect(page.locator(".gm-sidebar__server-card")).toHaveCount(1);
  await expect(page.getByTestId("gm-server-card-relay-backup-c-archive-test")).toBeVisible();

  await page.getByTestId("gm-player-search").fill("爱马仕");
  await expect(page.locator(".gm-sidebar__player-card")).toHaveCount(1);
  await expect(page.getByTestId("gm-player-card-relay-home-a-survival-main-preview-player-1")).toBeVisible();
});

test("gm desktop preview sends a broadcast and private message to the selected player", async ({ page }, testInfo) => {
  test.skip(isMobileProject(testInfo), "桌面链路仅在桌面项目执行");

  await gotoPreviewRoute(page, "/gm/chat", "gm-console");

  const chatInput = page.getByTestId("gm-chat-input");
  await chatInput.fill("预览广播：活动将在五分钟后开始");
  await page.getByTestId("gm-chat-send").click();
  await expect(page.getByTestId("gm-chat-body")).toContainText("预览广播：活动将在五分钟后开始");
  await expect(chatInput).toHaveValue("");

  await page.getByTestId("gm-player-card-relay-home-a-survival-main-preview-player-1").click();
  await page.getByTestId("gm-chat-target").locator("label.ant-segmented-item").filter({ hasText: "私聊" }).click();
  await chatInput.fill("预览私聊：请领取补偿");
  await page.getByTestId("gm-chat-send").click();
  await expect(page.getByTestId("gm-chat-body")).toContainText("预览私聊：请领取补偿");
});

test("economy preview confirms add, deduct, and set balance operations", async ({ page }) => {
  await gotoPreviewRoute(page, "/economy", "economy-console");

  const actionDialog = page.getByRole("dialog");
  const openAction = async () => {
    const action = page.locator('[data-testid^="economy-transaction-action-"]').first();
    await expect(action).toBeEnabled();
    await action.click();
    await expect(actionDialog).toBeVisible();
  };
  const confirmAction = async (expectedTitle: RegExp, expectedReason: string) => {
    await actionDialog.getByRole("button", { name: "下一步" }).click();
    const confirmDialog = page.locator(".ant-modal-confirm");
    await expect(confirmDialog).toContainText(expectedTitle);
    await confirmDialog.getByRole("button", { name: /确认执行/ }).click();
    await expect(page.getByTestId("economy-console")).toContainText(expectedReason);
  };

  await openAction();
  await actionDialog.getByRole("spinbutton", { name: "输入余额数值" }).fill("1200");
  await actionDialog.getByRole("button", { name: "下一步" }).click();
  const cancelledConfirm = page.locator(".ant-modal-confirm");
  await expect(cancelledConfirm).toContainText("确认增加余额");
  await cancelledConfirm.getByRole("button", { name: /取\s*消/ }).click();
  await expect(page.getByTestId("economy-console")).not.toContainText("GM 增加余额");

  await openAction();
  await actionDialog.getByRole("spinbutton", { name: "输入余额数值" }).fill("1200");
  await confirmAction(/确认增加余额/, "GM 增加余额");

  await openAction();
  await actionDialog.locator("label.ant-segmented-item").filter({ hasText: "扣除" }).click();
  await actionDialog.getByRole("spinbutton", { name: "输入余额数值" }).fill("200");
  await confirmAction(/确认扣除余额/, "GM 扣除余额");

  await openAction();
  await actionDialog.locator("label.ant-segmented-item").filter({ hasText: "设置" }).click();
  await actionDialog.getByRole("spinbutton", { name: "输入余额数值" }).fill("8800");
  await confirmAction(/确认设置余额/, "GM 设置余额");
});
