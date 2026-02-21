import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { View } from 'react-native';

export function MiniBarChart({
  values,
  labels,
  color = '#0f766e',
}: {
  values: number[];
  labels: string[];
  color?: string;
}) {
  const width = 320;
  const height = 160;
  const barWidth = Math.floor(width / Math.max(values.length, 1)) - 8;
  const max = Math.max(...values, 1);

  return (
    <View style={{ width: '100%', alignItems: 'center' }}>
      <Svg width={width} height={height}>
        {values.map((value, index) => {
          const barHeight = Math.round((value / max) * 100);
          const x = index * (barWidth + 8) + 10;
          const y = 120 - barHeight;

          return (
            <G key={`${labels[index]}-${index}`}>
              <Rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx={6} />
              <SvgText x={x} y={145} fontSize="10" fill="#0f172a">
                {labels[index]}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
