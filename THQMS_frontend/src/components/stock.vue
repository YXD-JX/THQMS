<template>
  <div>
    <h1>{{ stock.name }} 股票价格监控</h1>
    <div ref="chart" style="width: 600px;height:400px;"></div>
    <p>最新价格: {{ stock.latestPrice }}</p>
    <p>最高价格: {{ stock.highestPrice }}</p>
    <p>最低价格: {{ stock.lowestPrice }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import * as echarts from 'echarts';

interface Stock {
  name: string;
  latestPrice: number;
  highestPrice: number;
  lowestPrice: number;
  prices: number[];
}

export default defineComponent({
  name: 'StockChart',
  setup() {
    const chart = ref<HTMLDivElement | null>(null);
    const chartInstance = ref<echarts.ECharts | null>(null);
    const timerId = ref<number | undefined>(undefined);
    const stock = ref<Stock>({
      name: '腾讯控股',
      latestPrice: 0,
      highestPrice: 0,
      lowestPrice: 0,
      prices: []
    });

    // 模拟获取股票数据的函数，实际应用中应通过API调用
    const fetchStockData = () => {
      // 这里假设我们从某个API获取了新的股票数据
      const base = 500;
      const newPrices = Array.from({ length: 5 }, (_, i) => base + (Math.random() * 30 - 15) + i * 3);
      stock.value.prices = newPrices.map(v => parseFloat(v.toFixed(2)));
      stock.value.latestPrice = stock.value.prices[stock.value.prices.length - 1];
      stock.value.highestPrice = Math.max(...stock.value.prices);
      stock.value.lowestPrice = Math.min(...stock.value.prices);
    };

    const renderChart = () => {
      if (!chart.value) return;
      if (!chartInstance.value) {
        chartInstance.value = echarts.init(chart.value);
      }
      const labels = stock.value.prices.map((_, i) => `${(9 + i).toString().padStart(2, '0')}:00`);
      const option = {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: labels },
        yAxis: { type: 'value' },
        series: [{ data: stock.value.prices, type: 'line', smooth: true, areaStyle: { opacity: 0.1 } }]
      } as echarts.EChartsOption;
      chartInstance.value.setOption(option);
    };

    const handleResize = () => {
      chartInstance.value?.resize();
    };

    onMounted(async () => {
      await nextTick();
      fetchStockData(); // 初始获取数据
      renderChart();
      // 模拟每5秒更新一次数据
      timerId.value = window.setInterval(() => {
        fetchStockData();
        renderChart();
      }, 5000);
      window.addEventListener('resize', handleResize);
    });

    onBeforeUnmount(() => {
      if (timerId.value) {
        clearInterval(timerId.value);
        timerId.value = undefined;
      }
      window.removeEventListener('resize', handleResize);
      if (chartInstance.value) {
        chartInstance.value.dispose();
        chartInstance.value = null;
      }
    });

    // 仅监听价格数组变化，更新图表
    watch(() => stock.value.prices, () => {
      renderChart();
    });

    return {
      chart,
      stock
    };
  }
});
</script>
