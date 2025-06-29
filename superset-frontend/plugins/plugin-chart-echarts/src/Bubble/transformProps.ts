/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import type { EChartsCoreOption } from 'echarts/core';
import type { ScatterSeriesOption } from 'echarts/charts';
import { extent } from 'd3-array';
import {
  CategoricalColorNamespace,
  getNumberFormatter,
  AxisType,
  getMetricLabel,
  NumberFormatter,
  tooltipHtml,
} from '@superset-ui/core';
import { EchartsBubbleChartProps, EchartsBubbleFormData } from './types';
import { DEFAULT_FORM_DATA, MINIMUM_BUBBLE_SIZE } from './constants';
import { defaultGrid } from '../defaults';
import { getLegendProps, getMinAndMaxFromBounds } from '../utils/series';
import { Refs } from '../types';
import { parseAxisBound } from '../utils/controls';
import { getDefaultTooltip } from '../utils/tooltip';
import { getPadding } from '../Timeseries/transformers';
import { convertInteger } from '../utils/convertInteger';
import { NULL_STRING } from '../constants';

const isIterable = (obj: any): obj is Iterable<any> =>
  obj != null && typeof obj[Symbol.iterator] === 'function';

function normalizeSymbolSize(
  nodes: ScatterSeriesOption[],
  maxBubbleValue: number,
) {
  const [bubbleMinValue, bubbleMaxValue] = extent<ScatterSeriesOption, number>(
    nodes,
    x => {
      const tmpValue = x.data?.[0];
      const result = isIterable(tmpValue) ? tmpValue[2] : null;
      if (typeof result === 'number') {
        return result;
      }
      return null;
    },
  );
  if (bubbleMinValue !== undefined && bubbleMaxValue !== undefined) {
    const nodeSpread = bubbleMaxValue - bubbleMinValue;
    nodes.forEach(node => {
      const tmpValue = node.data?.[0];
      const calculated = isIterable(tmpValue) ? tmpValue[2] : null;
      if (typeof calculated === 'number') {
        // eslint-disable-next-line no-param-reassign
        node.symbolSize =
          (((calculated - bubbleMinValue) / nodeSpread) *
            (maxBubbleValue * 2) || 0) + MINIMUM_BUBBLE_SIZE;
      }
    });
  }
}

export function formatTooltip(
  params: any,
  xAxisLabel: string,
  yAxisLabel: string,
  sizeLabel: string,
  xAxisFormatter: NumberFormatter,
  yAxisFormatter: NumberFormatter,
  tooltipSizeFormatter: NumberFormatter,
) {
  const title = params.data[4]
    ? `${params.data[4]} (${params.data[3]})`
    : params.data[3];

  return tooltipHtml(
    [
      [xAxisLabel, xAxisFormatter(params.data[0])],
      [yAxisLabel, yAxisFormatter(params.data[1])],
      [sizeLabel, tooltipSizeFormatter(params.data[2])],
    ],
    title,
  );
}

export default function transformProps(chartProps: EchartsBubbleChartProps) {
  const { height, width, hooks, queriesData, formData, inContextMenu, theme } =
    chartProps;

  const { data = [] } = queriesData[0];
  const {
    x,
    y,
    size,
    entity,
    maxBubbleSize,
    colorScheme,
    series: bubbleSeries,
    xAxisLabel: bubbleXAxisTitle,
    yAxisLabel: bubbleYAxisTitle,
    xAxisBounds,
    xAxisFormat,
    yAxisFormat,
    yAxisBounds,
    logXAxis,
    logYAxis,
    xAxisTitleMargin,
    yAxisTitleMargin,
    truncateXAxis,
    truncateYAxis,
    xAxisLabelRotation,
    xAxisLabelInterval,
    yAxisLabelRotation,
    tooltipSizeFormat,
    opacity,
    showLegend,
    legendOrientation,
    legendMargin,
    legendType,
    sliceId,
  }: EchartsBubbleFormData = { ...DEFAULT_FORM_DATA, ...formData };
  const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);

  const legends = new Set<string>();
  const series: ScatterSeriesOption[] = [];

  const xAxisLabel: string = getMetricLabel(x);
  const yAxisLabel: string = getMetricLabel(y);
  const sizeLabel: string = getMetricLabel(size);

  const refs: Refs = {};

  data.forEach(datum => {
    const dataName = bubbleSeries ? datum[bubbleSeries] : datum[entity];
    const name = dataName ? String(dataName) : NULL_STRING;
    const bubbleSeriesValue = bubbleSeries ? datum[bubbleSeries] : null;

    series.push({
      name,
      data: [
        [
          datum[xAxisLabel],
          datum[yAxisLabel],
          datum[sizeLabel],
          datum[entity],
          bubbleSeriesValue as any,
        ],
      ],
      type: 'scatter',
      itemStyle: {
        color: colorFn(name, sliceId),
        opacity,
      },
    });
    legends.add(name);
  });

  normalizeSymbolSize(series, maxBubbleSize);

  const xAxisFormatter = getNumberFormatter(xAxisFormat);
  const yAxisFormatter = getNumberFormatter(yAxisFormat);
  const tooltipSizeFormatter = getNumberFormatter(tooltipSizeFormat);

  const [xAxisMin, xAxisMax] = (xAxisBounds || []).map(parseAxisBound);
  const [yAxisMin, yAxisMax] = (yAxisBounds || []).map(parseAxisBound);

  const padding = getPadding(
    showLegend,
    legendOrientation,
    true,
    false,
    legendMargin,
    true,
    'Left',
    convertInteger(yAxisTitleMargin),
    convertInteger(xAxisTitleMargin),
  );

  const xAxisType = logXAxis ? AxisType.Log : AxisType.Value;
  const echartOptions: EChartsCoreOption = {
    series,
    xAxis: {
      axisLabel: { formatter: xAxisFormatter },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      nameRotate: xAxisLabelRotation,
      interval: xAxisLabelInterval,
      scale: true,
      name: bubbleXAxisTitle,
      nameLocation: 'middle',
      nameTextStyle: {
        fontWeight: 'bolder',
      },
      nameGap: convertInteger(xAxisTitleMargin),
      type: xAxisType,
      ...getMinAndMaxFromBounds(xAxisType, truncateXAxis, xAxisMin, xAxisMax),
    },
    yAxis: {
      axisLabel: { formatter: yAxisFormatter },
      splitLine: {
        lineStyle: {
          type: 'dashed',
        },
      },
      nameRotate: yAxisLabelRotation,
      scale: truncateYAxis,
      name: bubbleYAxisTitle,
      nameLocation: 'middle',
      nameTextStyle: {
        fontWeight: 'bolder',
      },
      nameGap: convertInteger(yAxisTitleMargin),
      min: yAxisMin,
      max: yAxisMax,
      type: logYAxis ? AxisType.Log : AxisType.Value,
    },
    legend: {
      ...getLegendProps(legendType, legendOrientation, showLegend, theme),
      data: Array.from(legends),
    },
    tooltip: {
      show: !inContextMenu,
      ...getDefaultTooltip(refs),
      formatter: (params: any): string =>
        formatTooltip(
          params,
          xAxisLabel,
          yAxisLabel,
          sizeLabel,
          xAxisFormatter,
          yAxisFormatter,
          tooltipSizeFormatter,
        ),
    },
    grid: { ...defaultGrid, ...padding },
  };

  const { onContextMenu, setDataMask = () => {} } = hooks;

  return {
    refs,
    height,
    width,
    echartOptions,
    onContextMenu,
    setDataMask,
    formData,
  };
}
