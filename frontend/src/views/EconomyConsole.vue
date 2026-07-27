<script setup lang="ts">
import { OPERATIONS_MOBILE_NAV_ITEMS } from "@/components/operations/mobileNav";
import OperationsMobileNav from "@/components/operations/OperationsMobileNav.vue";
import OperationsPageShell from "@/components/operations/OperationsPageShell.vue";
import {
  ECONOMY_ALL_SERVERS_KEY,
  createEconomyServerKey,
  type EconomyRankingRangeKey,
  type EconomyTimeRangeKey,
  useEconomyConsoleState
} from "@/hooks/useEconomyConsoleState";
import { useEconomyConsolePreviewState } from "@/hooks/useEconomyConsolePreviewState";
import { useScreen } from "@/hooks/useScreen";
import { useAppStateStore } from "@/stores/useAppStateStore";
import {
  AppstoreOutlined,
  BarChartOutlined,
  CloudServerOutlined,
  DollarCircleOutlined,
  RiseOutlined,
  ReloadOutlined,
  SwapOutlined,
  WalletOutlined
} from "@ant-design/icons-vue";
import { Segmented as ASegmented } from "ant-design-vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

type EconomyMetricTone = "in" | "out" | "net" | "count" | "delay";
type EconomyTrendSeriesKey = "systemIn" | "systemOut";

const TREND_CHART_WIDTH = 760;
const TREND_CHART_HEIGHT = 280;
const TREND_CHART_LEFT = 56;
const TREND_CHART_RIGHT = 22;
const TREND_CHART_TOP = 18;
const TREND_CHART_BOTTOM = 42;
const TREND_PLOT_WIDTH = TREND_CHART_WIDTH - TREND_CHART_LEFT - TREND_CHART_RIGHT;
const TREND_PLOT_HEIGHT = TREND_CHART_HEIGHT - TREND_CHART_TOP - TREND_CHART_BOTTOM;
const TREND_PLOT_BASELINE = TREND_CHART_TOP + TREND_PLOT_HEIGHT;

const CATEGORY_LABELS: Record<IMcsmEconomyCategory, string> = {
  SYSTEM_IN: "系统投放",
  SYSTEM_OUT: "系统回收",
  PLAYER_TRANSFER: "玩家交易",
  TAX: "税费",
  ADMIN_ADJUST: "管理员调整",
  ROLLBACK: "回滚",
  UNKNOWN: "未知"
};

const RANGE_OPTIONS: Array<{ label: string; value: EconomyTimeRangeKey }> = [
  { label: "今日", value: "today" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" }
];

const RANKING_RANGE_OPTIONS: Array<{ label: string; value: EconomyRankingRangeKey }> = [
  { label: "日", value: "day" },
  { label: "周", value: "week" },
  { label: "月", value: "month" }
];

const RANKING_RANGE_LABELS: Record<EconomyRankingRangeKey, string> = {
  day: "日榜",
  week: "周榜",
  month: "月榜"
};

const { isPhone } = useScreen();
const router = useRouter();
const { state: appState } = useAppStateStore();
const shellRef = ref<InstanceType<typeof OperationsPageShell>>();

const isLocalPreviewMode = appState.userInfo?.token === "local-preview-token";
const economyState = isLocalPreviewMode ? useEconomyConsolePreviewState() : useEconomyConsoleState();

const {
  summary,
  servers,
  currencies,
  transactions,
  totalTransactions,
  selectedServerKey,
  selectedCurrencyType,
  selectedRange,
  selectedRankingRange,
  currentServer,
  currentCurrency,
  scopedHourly,
  sources,
  rankingRows,
  isRefreshing,
  isTransactionLoading,
  isRankingLoading,
  latestError,
  selectServer,
  selectCurrency,
  setTimeRange,
  setRankingRange,
  refreshCurrent
} = economyState;

const serverOptions = computed(() =>
  [
    {
      value: ECONOMY_ALL_SERVERS_KEY,
      label: "全部区",
      server: undefined
    },
    ...servers.value.map((server) => ({
      value: createEconomyServerKey(server.daemonId, server.instanceId),
      label: `${server.daemonDisplayName} / ${server.instanceDisplayName}`,
      server
    }))
  ]
);

const currencyOptions = computed(() =>
  currencies.value.length
    ? currencies.value
    : [
        {
          type: "money",
          name: "落叶币",
          totalBalance: 0,
          playerCount: 0
        }
      ]
);

const maxHourlyValue = computed(() => {
  const max = Math.max(
    ...scopedHourly.value.map((item) => Math.max(item.systemIn, item.systemOut)),
    1
  );
  return max || 1;
});

const maxSourceAmount = computed(() => Math.max(...sources.value.map((item) => item.amount), 1));

const isAllServersSelected = computed(
  () => !selectedServerKey.value || selectedServerKey.value === ECONOMY_ALL_SERVERS_KEY
);

const currentStatusText = computed(() => {
  if (isAllServersSelected.value) return `${summary.value.serversAvailable}/${summary.value.serversTotal} 区可用`;
  if (!currentServer.value) return "未选择实例";
  if (!currentServer.value.daemonAvailable) return "daemon 离线";
  if (!currentServer.value.pluginAvailable) return currentServer.value.pluginStatusText || "PlayerCurrency 未上报";
  return "PlayerCurrency 可用";
});

const currentStatusColor = computed(() => {
  if (isAllServersSelected.value) return summary.value.serversAvailable > 0 ? "green" : "default";
  if (!currentServer.value?.daemonAvailable) return "default";
  return currentServer.value.pluginAvailable ? "green" : "orange";
});

const scopeTitle = computed(() => currentServer.value?.instanceDisplayName || "全部区");
const scopeSubtitle = computed(() =>
  currentServer.value
    ? `${currentServer.value.daemonDisplayName} / ${currentServer.value.daemonId}`
    : `${summary.value.serversAvailable}/${summary.value.serversTotal} 区可用`
);

const selectedServersForDisplay = computed(() => (currentServer.value ? [currentServer.value] : servers.value));

const slowestServer = computed(() =>
  selectedServersForDisplay.value
    .filter((server) => server.dataDelayMs != null)
    .sort((a, b) => (b.dataDelayMs || 0) - (a.dataDelayMs || 0))[0]
);

const scopeDataDelayMs = computed(() =>
  currentServer.value ? currentServer.value.dataDelayMs : slowestServer.value?.dataDelayMs
);

const scopeDelayText = computed(() =>
  currentServer.value?.lastEventAt
    ? formatDateTime(currentServer.value.lastEventAt)
    : slowestServer.value?.lastEventAt
      ? `${slowestServer.value.instanceDisplayName} / ${formatDateTime(slowestServer.value.lastEventAt)}`
      : currentStatusText.value
);

const pageEyebrow = computed(() =>
  isLocalPreviewMode ? "本地预览 / PlayerCurrency / 审计只读" : "PlayerCurrency / 审计只读"
);

const summaryMetrics = computed<Array<{ label: string; value: string; sub: string; tone: EconomyMetricTone }>>(() => [
  {
    label: "今日投放",
    value: formatCurrencyAmount(summary.value.todayIn),
    sub: currentCurrency.value.name,
    tone: "in"
  },
  {
    label: "今日回收",
    value: formatCurrencyAmount(summary.value.todayOut),
    sub: currentCurrency.value.name,
    tone: "out"
  },
  {
    label: "净增发",
    value: formatSignedAmount(summary.value.netChange),
    sub: summary.value.netChange >= 0 ? "通胀方向" : "回收方向",
    tone: "net"
  },
  {
    label: "流水数量",
    value: String(summary.value.transactionCount),
    sub: `${summary.value.serversAvailable}/${summary.value.serversTotal} 实例可用`,
    tone: "count"
  },
  {
    label: "数据延迟",
    value: formatDelay(scopeDataDelayMs.value),
    sub: scopeDelayText.value,
    tone: "delay"
  }
]);

const trendTotals = computed(() => ({
  systemIn: scopedHourly.value.reduce((sum, item) => sum + item.systemIn, 0),
  systemOut: scopedHourly.value.reduce((sum, item) => sum + item.systemOut, 0),
  netChange: scopedHourly.value.reduce((sum, item) => sum + item.netChange, 0),
  transactionCount: scopedHourly.value.reduce((sum, item) => sum + item.transactionCount, 0)
}));

const trendPeak = computed(() =>
  scopedHourly.value
    .slice()
    .sort((a, b) => Math.max(b.systemIn, b.systemOut) - Math.max(a.systemIn, a.systemOut))[0]
);

const rankingMetaText = computed(() =>
  `${currentCurrency.value.name} / ${RANKING_RANGE_LABELS[selectedRankingRange.value]} / ${
    isAllServersSelected.value ? "全部区" : scopeTitle.value
  }`
);

const maxRankingAmount = computed(() => Math.max(...rankingRows.value.map((item) => item.amount), 1));

const trendGridLines = computed(() =>
  Array.from({ length: 5 }).map((_, index) => {
    const ratio = index / 4;
    const value = maxHourlyValue.value * (1 - ratio);
    return {
      y: TREND_CHART_TOP + TREND_PLOT_HEIGHT * ratio,
      label: formatCompactAmount(value)
    };
  })
);

const trendHourLabels = computed(() =>
  scopedHourly.value
    .map((item, index) => ({
      label: item.hour % 4 === 0 ? item.label : "",
      x: getTrendX(index),
      hour: item.hour
    }))
    .filter((item) => item.label)
);

const trendSeries = computed(() =>
  [
    {
      key: "systemIn" as const,
      label: "投放",
      color: "#10b981",
      fill: "url(#economyTrendInFill)"
    },
    {
      key: "systemOut" as const,
      label: "回收",
      color: "#ef4444",
      fill: "url(#economyTrendOutFill)"
    }
  ].map((series) => {
    const points = buildTrendPoints(series.key);
    return {
      ...series,
      points,
      linePath: buildLinePath(points),
      areaPath: buildAreaPath(points)
    };
  })
);

const transactionColumns = [
  {
    title: "时间",
    dataIndex: "occurredAt",
    key: "occurredAt",
    width: 158
  },
  {
    title: "区服",
    dataIndex: "instanceId",
    key: "instanceId",
    width: 150
  },
  {
    title: "玩家",
    dataIndex: "playerName",
    key: "playerName",
    width: 150
  },
  {
    title: "变动",
    dataIndex: "delta",
    key: "delta",
    width: 130,
    sorter: (a: IMcsmEconomyTransaction, b: IMcsmEconomyTransaction) => a.delta - b.delta
  },
  {
    title: "余额",
    dataIndex: "balanceAfter",
    key: "balanceAfter",
    width: 130,
    sorter: (a: IMcsmEconomyTransaction, b: IMcsmEconomyTransaction) => a.balanceAfter - b.balanceAfter
  },
  {
    title: "分类",
    dataIndex: "category",
    key: "category",
    width: 130
  },
  {
    title: "来源",
    dataIndex: "source",
    key: "source",
    width: 140
  },
  {
    title: "操作方",
    dataIndex: "operatorName",
    key: "operatorName",
    width: 140
  },
  {
    title: "原因",
    dataIndex: "operatorReason",
    key: "operatorReason"
  }
];

function formatCurrencyAmount(value: number | undefined) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0
  }).format(amount);
}

function formatSignedAmount(value: number | undefined) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}${formatCurrencyAmount(amount)}`;
}

function formatCompactAmount(value: number | undefined) {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 100_000_000) return `${Number((amount / 100_000_000).toFixed(1))}亿`;
  if (Math.abs(amount) >= 10_000) return `${Number((amount / 10_000).toFixed(1))}万`;
  return formatCurrencyAmount(amount);
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDelay(delayMs?: number) {
  if (delayMs == null) return "--";
  if (delayMs < 60_000) return `${Math.max(1, Math.round(delayMs / 1000))}s`;
  if (delayMs < 60 * 60_000) return `${Math.round(delayMs / 60_000)}m`;
  return `${Math.round(delayMs / 3_600_000)}h`;
}

function getCategoryLabel(category: IMcsmEconomyCategory) {
  return CATEGORY_LABELS[category] || category;
}

function getCategoryColor(category: IMcsmEconomyCategory) {
  if (category === "SYSTEM_IN") return "green";
  if (category === "SYSTEM_OUT") return "red";
  if (category === "TAX") return "orange";
  if (category === "ADMIN_ADJUST") return "blue";
  if (category === "PLAYER_TRANSFER") return "purple";
  return "default";
}

function getTrendX(index: number) {
  const length = Math.max(scopedHourly.value.length - 1, 1);
  return TREND_CHART_LEFT + (index / length) * TREND_PLOT_WIDTH;
}

function getTrendY(value: number) {
  const ratio = Math.min(1, Math.max(0, value / maxHourlyValue.value));
  return TREND_PLOT_BASELINE - ratio * TREND_PLOT_HEIGHT;
}

function buildTrendPoints(key: EconomyTrendSeriesKey) {
  return scopedHourly.value.map((item, index) => ({
    x: getTrendX(index),
    y: getTrendY(item[key]),
    value: item[key],
    hour: item.hour,
    label: item.label
  }));
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  const linePath = buildLinePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${linePath} L ${lastPoint.x.toFixed(2)} ${TREND_PLOT_BASELINE} L ${firstPoint.x.toFixed(2)} ${TREND_PLOT_BASELINE} Z`;
}

function getSourceWidth(amount: number) {
  const ratio = Math.min(1, amount / maxSourceAmount.value);
  return `${Math.max(8, Math.round(ratio * 100))}%`;
}

function getRankingWidth(amount: number) {
  const ratio = Math.min(1, amount / maxRankingAmount.value);
  return `${Math.max(6, Math.round(ratio * 100))}%`;
}

function getRankingChangeText(rankDelta: number) {
  if (rankDelta > 0) return `↑ ${rankDelta}`;
  if (rankDelta < 0) return `↓ ${Math.abs(rankDelta)}`;
  return "--";
}

function onRankingRangeChange(value: string | number) {
  if (value === "day" || value === "week" || value === "month") {
    setRankingRange(value);
  }
}

function getServerLabel(daemonId: string, instanceId: string) {
  const server = servers.value.find((item) => item.daemonId === daemonId && item.instanceId === instanceId);
  return server?.instanceDisplayName || instanceId || "--";
}

function onServerChange(value: unknown) {
  selectServer(String(value || ""));
}

function onCurrencyChange(value: unknown) {
  selectCurrency(String(value || ""));
}

function onRangeChange(value: string | number) {
  if (value === "today" || value === "24h" || value === "7d") {
    setTimeRange(value);
  }
}

function openControlPage() {
  router.push("/control");
}

function openGmPage() {
  router.push("/gm");
}
</script>

<template>
  <div class="economy-console-page" data-testid="economy-console">
    <OperationsPageShell
      ref="shellRef"
      title="经济中心"
      :eyebrow="pageEyebrow"
      back-label="GM"
      fallback-back-to="/gm"
      :show-sidebar-on-mobile="false"
      mobile-body-padding-bottom="92px"
      :mobile-nav-items="OPERATIONS_MOBILE_NAV_ITEMS"
      :hide-desktop-header="true"
      :hide-mobile-header="true"
      :hide-eyebrow-on-mobile="true"
    >
      <section class="economy-console__toolbar">
        <div class="economy-console__toolbar-main">
          <div class="economy-console__title-wrap">
            <div class="economy-console__eyebrow">{{ pageEyebrow }}</div>
            <div class="economy-console__title">经济中心</div>
          </div>
          <div class="economy-console__pills">
            <a-tag :color="currentStatusColor">{{ currentStatusText }}</a-tag>
            <a-tag>{{ currentCurrency.name }}</a-tag>
          </div>
        </div>

        <div class="economy-console__toolbar-actions">
          <a-button v-if="!isPhone" @click="openControlPage">
            <template #icon>
              <AppstoreOutlined />
            </template>
            <span>Control</span>
          </a-button>
          <a-button v-if="!isPhone" @click="openGmPage">
            <template #icon>
              <WalletOutlined />
            </template>
            <span>GM</span>
          </a-button>
          <a-button :loading="isRefreshing" @click="refreshCurrent(true)">
            <template #icon>
              <ReloadOutlined />
            </template>
            <span v-if="!isPhone">刷新</span>
          </a-button>
        </div>
      </section>

      <div class="economy-console">
        <a-alert
          v-if="latestError"
          class="economy-console__alert"
          type="error"
          show-icon
          :message="latestError"
          data-testid="economy-error-alert"
        />

        <section class="economy-console__filters">
          <a-select
            class="economy-console__filter economy-console__filter--server"
            :value="selectedServerKey"
            placeholder="选择服务器"
            @change="onServerChange"
          >
            <a-select-option
              v-for="option in serverOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </a-select-option>
          </a-select>

          <a-select
            class="economy-console__filter"
            :value="selectedCurrencyType"
            placeholder="货币"
            @change="onCurrencyChange"
          >
            <a-select-option
              v-for="currency in currencyOptions"
              :key="currency.type"
              :value="currency.type"
            >
              {{ currency.name }} / {{ currency.type }}
            </a-select-option>
          </a-select>

          <a-segmented
            class="economy-console__range"
            :value="selectedRange"
            :options="RANGE_OPTIONS"
            @change="onRangeChange"
          />
        </section>

        <section class="economy-console__metrics">
          <article
            v-for="metric in summaryMetrics"
            :key="metric.label"
            class="economy-console__metric"
            :class="`economy-console__metric--${metric.tone}`"
          >
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.sub }}</small>
          </article>
        </section>

        <section v-if="servers.length" class="economy-console__server-card">
          <div class="economy-console__server-copy">
            <div class="economy-console__server-kicker">
              <CloudServerOutlined />
              <span>{{ scopeSubtitle }}</span>
            </div>
            <div class="economy-console__server-title">{{ scopeTitle }}</div>
            <p>
              首版只读展示 PlayerCurrency 事件与快照，面板不直接读取游戏服数据库。
            </p>
          </div>
          <div class="economy-console__server-stats">
            <template v-if="currentServer">
              <a-tag :color="currentServer.daemonAvailable ? 'green' : 'default'">
                {{ currentServer.daemonAvailable ? "daemon 在线" : "daemon 离线" }}
              </a-tag>
              <a-tag :color="currentServer.pluginAvailable ? 'blue' : 'orange'">
                {{ currentServer.pluginStatusText }}
              </a-tag>
            </template>
            <template v-else>
              <a-tag :color="summary.serversAvailable > 0 ? 'green' : 'default'">
                {{ summary.serversAvailable }} 个区可用
              </a-tag>
              <a-tag>{{ summary.serversTotal }} 个区已接入</a-tag>
            </template>
          </div>
        </section>

        <section v-else class="economy-console__empty">
          <a-empty :image="false" description="当前没有可用服务器经济数据。" />
        </section>

        <section class="economy-console__main-grid">
          <article class="economy-console__panel economy-console__trend">
            <div class="economy-console__panel-head">
              <div>
                <div class="economy-console__panel-title">小时趋势</div>
                <div class="economy-console__panel-meta">投放、回收与净变化</div>
              </div>
              <div class="economy-console__trend-legend">
                <span class="economy-console__legend-dot economy-console__legend-dot--in" />投放
                <span class="economy-console__legend-dot economy-console__legend-dot--out" />回收
              </div>
            </div>

            <div class="economy-console__trend-summary">
              <div>
                <span>投放</span>
                <strong class="is-positive">{{ formatCurrencyAmount(trendTotals.systemIn) }}</strong>
              </div>
              <div>
                <span>回收</span>
                <strong class="is-negative">{{ formatCurrencyAmount(trendTotals.systemOut) }}</strong>
              </div>
              <div>
                <span>净变化</span>
                <strong>{{ formatSignedAmount(trendTotals.netChange) }}</strong>
              </div>
              <div>
                <span>峰值时段</span>
                <strong>{{ trendPeak?.label || "--" }}</strong>
              </div>
            </div>

            <div class="economy-console__trend-chart-wrap">
              <svg
                class="economy-console__trend-chart"
                :viewBox="`0 0 ${TREND_CHART_WIDTH} ${TREND_CHART_HEIGHT}`"
                role="img"
                aria-label="经济小时趋势图"
              >
                <defs>
                  <linearGradient id="economyTrendInFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#10b981" stop-opacity="0.28" />
                    <stop offset="100%" stop-color="#10b981" stop-opacity="0.03" />
                  </linearGradient>
                  <linearGradient id="economyTrendOutFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#ef4444" stop-opacity="0.22" />
                    <stop offset="100%" stop-color="#ef4444" stop-opacity="0.025" />
                  </linearGradient>
                </defs>

                <g class="economy-console__trend-grid">
                  <line
                    v-for="grid in trendGridLines"
                    :key="grid.y"
                    :x1="TREND_CHART_LEFT"
                    :x2="TREND_CHART_WIDTH - TREND_CHART_RIGHT"
                    :y1="grid.y"
                    :y2="grid.y"
                  />
                  <line
                    v-for="label in trendHourLabels"
                    :key="label.hour"
                    :x1="label.x"
                    :x2="label.x"
                    :y1="TREND_CHART_TOP"
                    :y2="TREND_PLOT_BASELINE"
                  />
                </g>

                <g class="economy-console__trend-axis">
                  <text
                    v-for="grid in trendGridLines"
                    :key="`y-${grid.y}`"
                    :x="TREND_CHART_LEFT - 10"
                    :y="grid.y + 4"
                    text-anchor="end"
                  >
                    {{ grid.label }}
                  </text>
                  <text
                    v-for="label in trendHourLabels"
                    :key="`x-${label.hour}`"
                    :x="label.x"
                    :y="TREND_PLOT_BASELINE + 24"
                    text-anchor="middle"
                  >
                    {{ label.hour }}
                  </text>
                </g>

                <g
                  v-for="series in trendSeries"
                  :key="series.key"
                  class="economy-console__trend-series"
                >
                  <path class="economy-console__trend-area" :d="series.areaPath" :fill="series.fill" />
                  <path class="economy-console__trend-line" :d="series.linePath" :stroke="series.color" />
                  <circle
                    v-for="point in series.points.filter((item) => item.value > 0)"
                    :key="`${series.key}-${point.hour}`"
                    class="economy-console__trend-point"
                    :cx="point.x"
                    :cy="point.y"
                    r="3"
                    :fill="series.color"
                  >
                    <title>{{ point.label }} {{ series.label }} {{ formatCurrencyAmount(point.value) }}</title>
                  </circle>
                </g>
              </svg>
            </div>
          </article>

          <article class="economy-console__panel economy-console__sources">
            <div class="economy-console__panel-head">
              <div>
                <div class="economy-console__panel-title">来源占比</div>
                <div class="economy-console__panel-meta">按 category/source 聚合</div>
              </div>
              <SwapOutlined />
            </div>

            <div class="economy-console__source-scroll">
              <div v-if="sources.length" class="economy-console__source-list">
                <article
                  v-for="source in sources"
                  :key="`${source.category}:${source.source}`"
                  class="economy-console__source"
                >
                  <div class="economy-console__source-top">
                    <div>
                      <strong>{{ source.source }}</strong>
                      <span>{{ getCategoryLabel(source.category) }} / {{ source.transactionCount }} 笔</span>
                    </div>
                    <em>{{ formatCurrencyAmount(source.amount) }}</em>
                  </div>
                  <div class="economy-console__source-track">
                    <span :style="{ width: getSourceWidth(source.amount) }" />
                  </div>
                </article>
              </div>
              <a-empty v-else :image="false" description="当前时间范围内没有来源数据。" />
            </div>
          </article>
        </section>

        <section class="economy-console__panel economy-console__ranking">
          <div class="economy-console__panel-head economy-console__ranking-head">
            <div>
              <div class="economy-console__panel-title">货币排行榜</div>
              <div class="economy-console__panel-meta">{{ rankingMetaText }}</div>
            </div>
            <div class="economy-console__ranking-actions">
              <a-segmented
                size="small"
                :value="selectedRankingRange"
                :options="RANKING_RANGE_OPTIONS"
                @change="onRankingRangeChange"
              />
              <RiseOutlined />
            </div>
          </div>

          <a-spin :spinning="isRankingLoading">
            <div class="economy-console__ranking-scroll">
              <template v-if="rankingRows.length">
                <div class="economy-console__ranking-header">
                  <span>名次</span>
                  <span>玩家</span>
                  <span>数额</span>
                  <span>名次变化</span>
                </div>
                <div class="economy-console__ranking-list">
                  <article
                    v-for="row in rankingRows"
                    :key="`${row.playerUuid}:${row.rank}`"
                    class="economy-console__ranking-row"
                  >
                    <div class="economy-console__ranking-rank">#{{ row.rank }}</div>
                    <div class="economy-console__ranking-player">
                      <strong>{{ row.playerName || "未知玩家" }}</strong>
                      <span>{{ row.serverName || row.playerUuid }}</span>
                    </div>
                    <div class="economy-console__ranking-amount">
                      <strong>{{ formatCurrencyAmount(row.amount) }}</strong>
                      <span>{{ currentCurrency.name }}</span>
                    </div>
                    <div
                      class="economy-console__ranking-change"
                      :class="{
                        'is-up': row.rankDelta > 0,
                        'is-down': row.rankDelta < 0,
                        'is-flat': row.rankDelta === 0
                      }"
                    >
                      {{ getRankingChangeText(row.rankDelta) }}
                    </div>
                    <div class="economy-console__ranking-track">
                      <span :style="{ width: getRankingWidth(row.amount) }" />
                    </div>
                  </article>
                </div>
              </template>
              <a-empty v-else :image="false" description="当前周期没有排行榜数据。" />
            </div>
          </a-spin>
        </section>

        <section class="economy-console__panel economy-console__audit">
          <div class="economy-console__panel-head">
            <div>
              <div class="economy-console__panel-title">流水审计</div>
              <div class="economy-console__panel-meta">
                当前显示 {{ transactions.length }} / {{ totalTransactions }} 笔
              </div>
            </div>
            <DollarCircleOutlined />
          </div>

          <a-spin :spinning="isTransactionLoading">
            <template v-if="!isPhone">
              <a-table
                row-key="id"
                size="small"
                :columns="transactionColumns"
                :data-source="transactions"
                :pagination="{ pageSize: 20, showSizeChanger: false }"
                :scroll="{ x: 1280, y: 420 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'occurredAt'">
                    {{ formatDateTime(record.occurredAt) }}
                  </template>
                  <template v-else-if="column.key === 'instanceId'">
                    {{ getServerLabel(record.daemonId, record.instanceId) }}
                  </template>
                  <template v-else-if="column.key === 'playerName'">
                    <div class="economy-console__table-identity">
                      <strong>{{ record.playerName || "未知玩家" }}</strong>
                      <span>{{ record.playerUuid }}</span>
                    </div>
                  </template>
                  <template v-else-if="column.key === 'delta'">
                    <span
                      class="economy-console__amount"
                      :class="{ 'is-positive': record.delta > 0, 'is-negative': record.delta < 0 }"
                    >
                      {{ formatSignedAmount(record.delta) }}
                    </span>
                  </template>
                  <template v-else-if="column.key === 'balanceAfter'">
                    {{ formatCurrencyAmount(record.balanceAfter) }}
                  </template>
                  <template v-else-if="column.key === 'category'">
                    <a-tag :color="getCategoryColor(record.category)">
                      {{ getCategoryLabel(record.category) }}
                    </a-tag>
                  </template>
                  <template v-else-if="column.key === 'source'">
                    {{ record.source || "--" }}
                  </template>
                  <template v-else-if="column.key === 'operatorName'">
                    {{ record.operatorName || "--" }}
                  </template>
                  <template v-else-if="column.key === 'operatorReason'">
                    <span class="economy-console__reason">{{ record.operatorReason || "--" }}</span>
                  </template>
                </template>
              </a-table>
            </template>

            <div v-else class="economy-console__mobile-transactions">
              <article
                v-for="transaction in transactions"
                :key="transaction.id"
                class="economy-console__mobile-transaction"
              >
                <div class="economy-console__mobile-transaction-top">
                  <div>
                    <strong>{{ transaction.playerName || "未知玩家" }}</strong>
                    <span>{{ formatDateTime(transaction.occurredAt) }}</span>
                  </div>
                  <em
                    class="economy-console__amount"
                    :class="{ 'is-positive': transaction.delta > 0, 'is-negative': transaction.delta < 0 }"
                  >
                    {{ formatSignedAmount(transaction.delta) }}
                  </em>
                </div>
                <div class="economy-console__mobile-transaction-meta">
                  <span>{{ getServerLabel(transaction.daemonId, transaction.instanceId) }}</span>
                  <a-tag :color="getCategoryColor(transaction.category)">
                    {{ getCategoryLabel(transaction.category) }}
                  </a-tag>
                  <span>{{ transaction.source || transaction.operatorName || "unknown" }}</span>
                  <span>余额 {{ formatCurrencyAmount(transaction.balanceAfter) }}</span>
                </div>
                <p>{{ transaction.operatorReason || "无操作原因" }}</p>
              </article>
              <a-empty v-if="!transactions.length" :image="false" description="当前没有流水。" />
            </div>
          </a-spin>
        </section>
      </div>
    </OperationsPageShell>

    <OperationsMobileNav
      v-if="shellRef?.isPhone && OPERATIONS_MOBILE_NAV_ITEMS.length"
      :items="OPERATIONS_MOBILE_NAV_ITEMS"
      class="economy-console__mobile-nav"
    />
  </div>
</template>

<style scoped lang="scss">
.economy-console-page {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;

  :deep(.ops-page-shell) {
    background:
      radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 28%),
      radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 28%),
      linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(241, 245, 249, 0.98));
  }

  :deep(.ops-page-shell--desktop-embedded) {
    height: calc(100svh - 64px);
    min-height: 0;
    overflow: hidden;
  }

  :deep(.ops-page-shell--desktop-embedded .ops-page-shell__shell) {
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  :deep(.ops-page-shell--desktop-embedded .ops-page-shell__workspace) {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
}

.economy-console__toolbar,
.economy-console__toolbar-main,
.economy-console__toolbar-actions,
.economy-console__pills,
.economy-console__panel-head,
.economy-console__server-card,
.economy-console__server-kicker,
.economy-console__source-top,
.economy-console__mobile-transaction-top,
.economy-console__mobile-transaction-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.economy-console__toolbar {
  justify-content: space-between;
  padding-bottom: 4px;
  flex-shrink: 0;
}

.economy-console__toolbar-main {
  flex: 1;
  justify-content: space-between;
}

.economy-console__toolbar-actions {
  justify-content: flex-end;
}

.economy-console__title-wrap {
  min-width: 0;
}

.economy-console__eyebrow,
.economy-console__panel-meta,
.economy-console__server-kicker,
.economy-console__server-card p,
.economy-console__metric span,
.economy-console__metric small,
.economy-console__table-identity span,
.economy-console__source span,
.economy-console__mobile-transaction-top span,
.economy-console__mobile-transaction-meta,
.economy-console__mobile-transaction p {
  color: var(--color-gray-7);
}

.economy-console__eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.economy-console__title {
  margin-top: 4px;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--color-gray-13);
}

.economy-console {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  height: 100%;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 4px;
}

.economy-console__alert {
  flex-shrink: 0;
}

.economy-console > * {
  flex-shrink: 0;
}

.economy-console__filters {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(180px, 240px) auto;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
}

.economy-console__filter {
  width: 100%;
}

.economy-console__metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.economy-console__metric,
.economy-console__server-card,
.economy-console__panel,
.economy-console__empty {
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    0 16px 36px rgba(15, 23, 42, 0.08),
    0 2px 8px rgba(15, 23, 42, 0.04);
}

.economy-console__metric {
  position: relative;
  overflow: hidden;
  padding: 14px 16px;
}

.economy-console__metric::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  content: "";
  background: var(--metric-accent, var(--color-blue-6));
}

.economy-console__metric--in {
  --metric-accent: #16a34a;
}

.economy-console__metric--out {
  --metric-accent: #dc2626;
}

.economy-console__metric--net {
  --metric-accent: #2563eb;
}

.economy-console__metric--count {
  --metric-accent: #7c3aed;
}

.economy-console__metric--delay {
  --metric-accent: #f59e0b;
}

.economy-console__metric strong {
  display: block;
  margin-top: 8px;
  font-size: 24px;
  line-height: 1.2;
  color: var(--color-gray-13);
  word-break: break-word;
}

.economy-console__metric small {
  display: block;
  margin-top: 6px;
  line-height: 1.4;
  word-break: break-word;
}

.economy-console__server-card {
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px;
}

.economy-console__server-copy {
  min-width: 0;
}

.economy-console__server-kicker {
  font-size: 12px;
}

.economy-console__server-title {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-gray-13);
}

.economy-console__server-card p {
  margin: 8px 0 0;
}

.economy-console__server-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.economy-console__empty {
  display: grid;
  min-height: 160px;
  place-items: center;
}

.economy-console__main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 14px;
  min-width: 0;
}

.economy-console__panel {
  min-width: 0;
  padding: 16px;
}

.economy-console__panel-head {
  justify-content: space-between;
  margin-bottom: 14px;
}

.economy-console__panel-head > span,
.economy-console__panel-head > .anticon {
  color: var(--color-gray-8);
  font-size: 20px;
}

.economy-console__panel-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-gray-13);
}

.economy-console__panel-meta {
  margin-top: 4px;
}

.economy-console__trend {
  min-height: 430px;
}

.economy-console__trend-legend,
.economy-console__trend-summary {
  display: flex;
  align-items: center;
  min-width: 0;
}

.economy-console__trend-legend {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  color: var(--color-gray-7);
  font-size: 12px;
}

.economy-console__legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.economy-console__legend-dot--in {
  background: #10b981;
}

.economy-console__legend-dot--out {
  background: #ef4444;
}

.economy-console__trend-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.economy-console__trend-summary > div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 10px;
  background: rgba(248, 250, 252, 0.78);
}

.economy-console__trend-summary span {
  display: block;
  color: var(--color-gray-7);
  font-size: 12px;
}

.economy-console__trend-summary strong {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: var(--color-gray-13);
  font-size: 18px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.economy-console__trend-summary strong.is-positive {
  color: #047857;
}

.economy-console__trend-summary strong.is-negative {
  color: #b91c1c;
}

.economy-console__trend-chart-wrap {
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 2px 0;
}

.economy-console__trend-chart {
  display: block;
  width: 100%;
  min-width: 680px;
  height: 300px;
}

.economy-console__trend-grid line {
  stroke: rgba(148, 163, 184, 0.2);
  stroke-width: 1;
}

.economy-console__trend-axis text {
  fill: var(--color-gray-6);
  font-size: 11px;
}

.economy-console__trend-line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.economy-console__trend-area {
  stroke: none;
}

.economy-console__trend-point {
  stroke: #fff;
  stroke-width: 2;
}

.economy-console__source-scroll {
  max-height: 348px;
  overflow-y: auto;
  padding-right: 4px;
}

.economy-console__source-scroll,
.economy-console__ranking-scroll,
.economy-console__trend-chart-wrap,
.economy-console__mobile-transactions {
  scrollbar-color: rgba(148, 163, 184, 0.7) transparent;
  scrollbar-width: thin;
}

.economy-console__source-scroll::-webkit-scrollbar,
.economy-console__ranking-scroll::-webkit-scrollbar,
.economy-console__trend-chart-wrap::-webkit-scrollbar,
.economy-console__mobile-transactions::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.economy-console__source-scroll::-webkit-scrollbar-thumb,
.economy-console__ranking-scroll::-webkit-scrollbar-thumb,
.economy-console__trend-chart-wrap::-webkit-scrollbar-thumb,
.economy-console__mobile-transactions::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.55);
}

.economy-console__source-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.economy-console__source {
  min-width: 0;
}

.economy-console__source-top {
  justify-content: space-between;
  align-items: flex-start;
}

.economy-console__source-top > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.economy-console__source strong,
.economy-console__source span {
  overflow-wrap: anywhere;
}

.economy-console__source em {
  flex-shrink: 0;
  color: var(--color-gray-13);
  font-style: normal;
  font-weight: 700;
}

.economy-console__source-track {
  height: 8px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
}

.economy-console__source-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #2563eb);
}

.economy-console__ranking {
  min-height: 0;
}

.economy-console__ranking-head {
  align-items: flex-start;
}

.economy-console__ranking-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.economy-console__ranking-actions > .anticon {
  color: #0f766e;
  font-size: 20px;
}

.economy-console__ranking-scroll {
  max-height: 336px;
  overflow-y: auto;
  padding-right: 4px;
}

.economy-console__ranking-header,
.economy-console__ranking-row {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr) minmax(120px, 0.34fr) 92px;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.economy-console__ranking-header {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0 12px 8px;
  color: var(--color-gray-6);
  font-size: 12px;
  background: rgba(255, 255, 255, 0.96);
}

.economy-console__ranking-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.economy-console__ranking-row {
  position: relative;
  overflow: hidden;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.82);
}

.economy-console__ranking-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 32px;
  border-radius: 10px;
  color: #0f172a;
  font-weight: 700;
  background: rgba(226, 232, 240, 0.86);
}

.economy-console__ranking-row:nth-child(1) .economy-console__ranking-rank {
  color: #713f12;
  background: rgba(250, 204, 21, 0.24);
}

.economy-console__ranking-row:nth-child(2) .economy-console__ranking-rank {
  color: #334155;
  background: rgba(203, 213, 225, 0.58);
}

.economy-console__ranking-row:nth-child(3) .economy-console__ranking-rank {
  color: #7c2d12;
  background: rgba(251, 146, 60, 0.2);
}

.economy-console__ranking-player,
.economy-console__ranking-amount {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.economy-console__ranking-player strong,
.economy-console__ranking-amount strong {
  overflow: hidden;
  color: var(--color-gray-13);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.economy-console__ranking-player span,
.economy-console__ranking-amount span {
  overflow: hidden;
  color: var(--color-gray-7);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.economy-console__ranking-change {
  justify-self: end;
  min-width: 58px;
  padding: 5px 9px;
  border-radius: 999px;
  color: var(--color-gray-7);
  font-weight: 700;
  text-align: center;
  background: rgba(226, 232, 240, 0.78);
}

.economy-console__ranking-change.is-up {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

.economy-console__ranking-change.is-down {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.11);
}

.economy-console__ranking-track {
  grid-column: 2 / 5;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.78);
}

.economy-console__ranking-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0ea5e9, #10b981);
}

.economy-console__audit {
  min-height: 0;
}

.economy-console__audit :deep(.ant-table-wrapper),
.economy-console__audit :deep(.ant-spin-nested-loading),
.economy-console__audit :deep(.ant-spin-container) {
  min-width: 0;
}

.economy-console__audit :deep(.ant-table-body) {
  scrollbar-color: rgba(148, 163, 184, 0.7) transparent;
  scrollbar-width: thin;
}

.economy-console__audit :deep(.ant-table-body::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

.economy-console__audit :deep(.ant-table-body::-webkit-scrollbar-thumb) {
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.55);
}

.economy-console__table-identity {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.economy-console__table-identity strong,
.economy-console__table-identity span,
.economy-console__reason {
  display: block;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.economy-console__amount {
  color: var(--color-gray-10);
  font-style: normal;
  font-weight: 700;
}

.economy-console__amount.is-positive {
  color: #15803d;
}

.economy-console__amount.is-negative {
  color: #b91c1c;
}

.economy-console__mobile-transactions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 620px;
  overflow-y: auto;
  padding-right: 2px;
}

.economy-console__mobile-transaction {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.88);
}

.economy-console__mobile-transaction-top {
  justify-content: space-between;
  align-items: flex-start;
}

.economy-console__mobile-transaction-top > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.economy-console__mobile-transaction-meta {
  flex-wrap: wrap;
  margin-top: 10px;
  line-height: 1.5;
}

.economy-console__mobile-transaction p {
  margin: 10px 0 0;
  overflow-wrap: anywhere;
}

.economy-console__mobile-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}

@media (max-width: 1180px) {
  .economy-console__metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .economy-console__main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .economy-console {
    height: auto;
    overflow: visible;
    padding-bottom: 0;
  }

  .economy-console__toolbar {
    align-items: flex-start;
  }

  .economy-console__toolbar-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .economy-console__title {
    font-size: 24px;
  }

  .economy-console__filters {
    grid-template-columns: 1fr;
    padding: 12px;
  }

  .economy-console__range {
    width: 100%;
  }

  .economy-console__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .economy-console__metric {
    padding: 12px;
  }

  .economy-console__metric strong {
    font-size: 19px;
  }

  .economy-console__server-card {
    flex-direction: column;
    padding: 14px;
  }

  .economy-console__server-stats {
    justify-content: flex-start;
  }

  .economy-console__panel {
    padding: 14px;
  }

  .economy-console__trend {
    min-height: 0;
  }

  .economy-console__trend-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .economy-console__trend-chart {
    min-width: 640px;
    height: 260px;
  }

  .economy-console__source-scroll {
    max-height: 320px;
  }

  .economy-console__ranking-head {
    flex-direction: column;
    align-items: stretch;
  }

  .economy-console__ranking-actions {
    justify-content: space-between;
  }

  .economy-console__ranking-scroll {
    max-height: 360px;
  }

  .economy-console__ranking-header {
    display: none;
  }

  .economy-console__ranking-row {
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 10px;
  }

  .economy-console__ranking-amount {
    grid-column: 2 / 3;
  }

  .economy-console__ranking-change {
    grid-column: 3 / 4;
    grid-row: 1 / 3;
    align-self: center;
  }

  .economy-console__ranking-track {
    grid-column: 1 / 4;
  }
}

@media (max-width: 420px) {
  .economy-console__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
