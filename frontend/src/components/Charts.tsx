import ReactECharts from 'echarts-for-react';
import type { TimeSeriesPoint, UrgencyBucket } from '../types';

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#dc2626',
  medium: '#ffffff',
  low: '#525252',
};

export function UrgencyChart({ data }: { data: UrgencyBucket[] }) {
  const option = {
    backgroundColor: 'transparent',
    grid: { left: 80, right: 24, top: 16, bottom: 24 },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#7f1d1d' } },
      splitLine: { lineStyle: { color: '#1a1a1a' } },
      axisLabel: { color: '#a3a3a3' },
    },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.urgency).reverse(),
      axisLine: { lineStyle: { color: '#7f1d1d' } },
      axisLabel: { color: '#ffffff', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: data
          .map((d) => ({
            value: d.count,
            itemStyle: { color: severityColors[d.urgency] || '#525252' },
          }))
          .reverse(),
        barWidth: 14,
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 200 }} opts={{ renderer: 'canvas' }} />;
}

export function TimelineChart({ data }: { data: TimeSeriesPoint[] }) {
  const option = {
    backgroundColor: 'transparent',
    legend: {
      data: ['Red Team', 'Blue Team', 'Metasploitable'],
      textStyle: { color: '#ffffff', fontSize: 11 },
      top: 0,
    },
    grid: { left: 40, right: 16, top: 36, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f0f0f',
      borderColor: '#dc2626',
      textStyle: { color: '#fff' },
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.time),
      axisLabel: { color: '#737373', fontSize: 10, interval: Math.floor(data.length / 6) },
      axisLine: { lineStyle: { color: '#7f1d1d' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#a3a3a3' },
      splitLine: { lineStyle: { color: '#1a1a1a' } },
    },
    series: [
      {
        name: 'Red Team',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.red),
        lineStyle: { color: '#ef4444', width: 2 },
        itemStyle: { color: '#ef4444' },
        areaStyle: { color: 'rgba(239,68,68,0.12)' },
        showSymbol: false,
      },
      {
        name: 'Blue Team',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.blue),
        lineStyle: { color: '#ffffff', width: 2 },
        itemStyle: { color: '#ffffff' },
        areaStyle: { color: 'rgba(255,255,255,0.06)' },
        showSymbol: false,
      },
      {
        name: 'Metasploitable',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.target),
        lineStyle: { color: '#b91c1c', width: 2 },
        itemStyle: { color: '#b91c1c' },
        areaStyle: { color: 'rgba(185,28,28,0.12)' },
        showSymbol: false,
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 220 }} opts={{ renderer: 'canvas' }} />;
}
