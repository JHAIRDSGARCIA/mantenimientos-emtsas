import { ReactNode, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import { theme } from '@/lib/theme';
import { X } from 'lucide-react-native';

export function Card({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  color,
  backgroundColor,
}: {
  label: string;
  color: string;
  backgroundColor?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: backgroundColor || `${color}20` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: any;
  icon?: ReactNode;
}) {
  const bg =
    variant === 'primary'
      ? theme.colors.primary
      : variant === 'danger'
      ? theme.colors.danger
      : variant === 'secondary'
      ? theme.colors.neutral200
      : 'transparent';
  const textColor =
    variant === 'outline' ? theme.colors.primary : variant === 'secondary' ? theme.colors.neutral800 : '#fff';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor: bg, borderColor: variant === 'outline' ? theme.colors.primary : 'transparent' }, disabled && { opacity: 0.5 }, style]}
    >
      {loading ? (
        <Text style={[styles.buttonText, { color: textColor }]}>Cargando...</Text>
      ) : (
        <View style={styles.buttonContent}>
          {icon}
          <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  error,
  editable = true,
}: {
  label?: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  error?: string;
  editable?: boolean;
}) {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, error && styles.inputError]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          editable={editable}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

export function Select({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Seleccionar...',
  error,
}: {
  label?: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value || placeholder;

  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity style={styles.selectButton} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !value && { color: theme.colors.textMuted }]}>
          {selectedLabel}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || 'Seleccionar'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <X size={20} color={theme.colors.neutral700} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.optionsList}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.option, value === opt && styles.optionSelected]}
                  onPress={() => {
                    onSelect(opt);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      value === opt && { color: theme.colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.emptyState}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
    </View>
  );
}

export function LoadingScreen({ message = 'Cargando...' }: { message?: string }) {
  return (
    <View style={styles.loadingScreen}>
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.neutral700,
    marginBottom: 6,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    paddingVertical: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.error,
    marginTop: 4,
  },
  selectButton: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  chevron: {
    fontSize: 16,
    color: theme.colors.neutral400,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  optionsList: {
    maxHeight: 300,
  },
  option: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral100,
  },
  optionSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  optionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.neutral700,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    flex: 1,
  },
  retryText: {
    color: theme.colors.error,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
});
