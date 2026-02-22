import { Text, View } from 'react-native';

export function AppFooter() {
  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#bae6fd',
        backgroundColor: '#ecfeff',
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ textAlign: 'center', color: '#155e75', fontSize: 12, fontWeight: '700' }}>
        Hecha ❤️ desde Málaga por Mateo y Roberto
      </Text>
    </View>
  );
}
