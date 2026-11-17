import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type PressableProps,
  type ScrollViewProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold';

export function Text({
  weight = 'regular',
  muted = false,
  color,
  style,
  ...props
}: React.ComponentProps<typeof NativeText> & {
  weight?: FontWeight;
  muted?: boolean;
  color?: string;
}) {
  const colors = useColors();
  const fontFamily = {
    regular: 'IBMPlexSansArabic_400Regular',
    medium: 'IBMPlexSansArabic_500Medium',
    semibold: 'IBMPlexSansArabic_600SemiBold',
    bold: 'IBMPlexSansArabic_700Bold',
  }[weight];

  return (
    <NativeText
      {...props}
      style={[
        { color: color ?? (muted ? colors.mutedForeground : colors.foreground), fontFamily, writingDirection: 'rtl' },
        style,
      ]}
    />
  );
}

export function AppScreen({
  children,
  scroll = true,
  contentContainerStyle,
  ...props
}: ScrollViewProps & { scroll?: boolean; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.safe,
        { backgroundColor: colors.background },
        Platform.OS === 'web' ? styles.webTopInset : null,
      ]}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.screenContent, contentContainerStyle]}
          {...props}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, { flex: 1 }, contentContainerStyle]} {...(props as ViewProps)}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, ...props }: ViewProps & { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      {...props}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ActionButton({
  title,
  icon,
  variant = 'primary',
  loading = false,
  style,
  textStyle,
  ...props
}: Omit<PressableProps, 'style'> & {
  title: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  loading?: boolean;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const palette = {
    primary: { backgroundColor: colors.primary, borderColor: colors.primary, text: colors.primaryForeground },
    secondary: { backgroundColor: colors.secondary, borderColor: colors.border, text: colors.secondaryForeground },
    outline: { backgroundColor: 'transparent', borderColor: colors.border, text: colors.foreground },
    danger: { backgroundColor: colors.destructive, borderColor: colors.destructive, text: colors.destructiveForeground },
  }[variant];
  return (
    <Pressable
      {...props}
      disabled={props.disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor, opacity: pressed ? 0.82 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.text} size="small" /> : null}
      {!loading && icon ? <Ionicons name={icon} size={18} color={palette.text} /> : null}
      <Text weight="semibold" color={palette.text} style={[styles.buttonText, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  containerStyle,
  ...props
}: TextInputProps & { label: string; error?: string; containerStyle?: object }) {
  const colors = useColors();
  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      <Text weight="medium" style={styles.fieldLabel}>{label}</Text>
      <NativeTextInput
        {...props}
        placeholderTextColor={colors.mutedForeground}
        selectionColor={colors.gold}
        textAlign="right"
        style={[
          styles.input,
          { backgroundColor: colors.background, borderColor: error ? colors.destructive : colors.input, color: colors.foreground },
          props.style,
        ]}
      />
      {error ? <Text color={colors.destructive} style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <Text weight="bold" style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text muted style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function IconBadge({
  name,
  color,
  backgroundColor,
  size = 20,
}: {
  name: IconName;
  color?: string;
  backgroundColor?: string;
  size?: number;
}) {
  const colors = useColors();
  return (
    <View style={[styles.iconBadge, { backgroundColor: backgroundColor ?? colors.accent }]}>
      <Ionicons name={name} size={size} color={color ?? colors.gold} />
    </View>
  );
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const colors = useColors();
  const map = {
    success: { background: colors.success + '20', foreground: colors.success },
    warning: { background: colors.gold + '28', foreground: colors.gold },
    danger: { background: colors.destructive + '20', foreground: colors.destructive },
    neutral: { background: colors.muted, foreground: colors.mutedForeground },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.background }]}>
      <Text weight="semibold" color={map.foreground} style={{ fontSize: 11 }}>{label}</Text>
    </View>
  );
}

export function LoadingState({ label = 'جارٍ تحميل البيانات...' }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={styles.stateBox}>
      <ActivityIndicator color={colors.gold} />
      <Text muted style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const colors = useColors();
  return (
    <Card style={styles.errorCard}>
      <IconBadge name="alert-circle-outline" color={colors.destructive} backgroundColor={colors.destructive + '18'} />
      <Text weight="semibold" style={styles.stateText}>{message}</Text>
      {onRetry ? <ActionButton title="إعادة المحاولة" variant="outline" icon="refresh" onPress={onRetry} /> : null}
    </Card>
  );
}

export function EmptyState({ title, message, icon = 'file-tray-outline' }: { title: string; message: string; icon?: IconName }) {
  const colors = useColors();
  return (
    <View style={styles.stateBox}>
      <IconBadge name={icon} size={24} color={colors.mutedForeground} backgroundColor={colors.muted} />
      <Text weight="semibold" style={styles.stateText}>{title}</Text>
      <Text muted style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

export function formatJod(fils: number | null | undefined): string {
  return new Intl.NumberFormat('ar-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format((fils ?? 0) / 1000);
}

export function formatJordanDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value.includes('T') ? value : `${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ar-JO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Amman',
  }).format(date);
}

export function errorMessage(error: unknown, fallback = 'تعذر إكمال العملية. حاول مرة أخرى.') {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: string; response?: { data?: { error?: string } } };
    return candidate.response?.data?.error ?? candidate.message ?? fallback;
  }
  return fallback;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  webTopInset: { paddingTop: 67 },
  screenContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30, gap: 14 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 16, gap: 12 },
  button: { minHeight: 46, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  buttonText: { fontSize: 14, textAlign: 'center' },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 13, textAlign: 'right' },
  input: { borderWidth: 1, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'IBMPlexSansArabic_400Regular', fontSize: 14, writingDirection: 'rtl' },
  fieldError: { fontSize: 12, textAlign: 'right' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  sectionTitle: { fontSize: 18, textAlign: 'right' },
  sectionSubtitle: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  iconBadge: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, alignSelf: 'flex-start' },
  stateBox: { minHeight: 138, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  stateText: { textAlign: 'center', fontSize: 14 },
  emptyMessage: { fontSize: 12, textAlign: 'center', lineHeight: 20 },
  errorCard: { alignItems: 'center', paddingVertical: 20 },
  sectionSubtitleDummy: {},
});
