import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'No encontrado' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Página no encontrada</Text>
        <Link href="/" style={styles.link}>
          Volver al inicio
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
  },
  link: {
    marginTop: 16,
    color: theme.colors.primary,
    fontSize: 16,
  },
});
