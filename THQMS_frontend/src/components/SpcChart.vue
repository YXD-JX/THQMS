<template>
  <div ref="root" :style="{ width: '100%', height }"></div>

</template>

<script lang="ts" setup>
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue';
import * as echarts from 'echarts';

interface Props {
  title?: string;
  labels: string[];
  values: number[];
  lcl?: number;
  ucl?: number;
  height?: string;
}

const props = defineProps<Props>();
const root = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

const render = () => {
  if (!root.value) return;
  if (!chart) chart = echarts.init(root.value);
  const series: echarts.SeriesOption[] = [
    {
      name: '测量值',
      type: 'line',
      data: props.values,
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.08 },
      lineStyle: { width: 2 },
    },
  ];
  if (typeof props.lcl === 'number') {
    series.push({
      name: 'LCL',
      type: 'line',
      data: props.values.map(() => props.lcl as number),
      showSymbol: false,
      lineStyle: { type: 'dashed', color: '#ef4444' }
    });
  }
  if (typeof props.ucl === 'number') {
    series.push({
      name: 'UCL',
      type: 'line',
      data: props.values.map(() => props.ucl as number),
      showSymbol: false,
      lineStyle: { type: 'dashed', color: '#6366f1' }
    });
  }
  const option: echarts.EChartsOption = {
    title: props.title ? { text: props.title } : undefined,
    tooltip: { trigger: 'axis' },
    grid: { left: 36, right: 16, top: 32, bottom: 32 },
    xAxis: { type: 'category', data: props.labels },
    yAxis: { type: 'value' },
    series,
  };
  chart.setOption(option);
};

onMounted(async () => {
  await nextTick();
  render();
  window.addEventListener('resize', () => chart?.resize());
});

onBeforeUnmount(() => {
  chart?.dispose();
  chart = null;
});

watch(() => [props.labels, props.values, props.lcl, props.ucl], () => {
  render();
}, { deep: true });

defineExpose({ refresh: render });
</script>

<style scoped>
</style>
