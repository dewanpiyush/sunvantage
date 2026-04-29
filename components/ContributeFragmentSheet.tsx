import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useDawn } from '@/hooks/use-dawn';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CARD_WIDTH_RATIO = 0.9;
const CARD_MAX_WIDTH = 420;
const CARD_MAX_HEIGHT_RATIO = 0.7;

type FragmentType = 'Belief' | 'Ritual' | 'Story' | 'Observation' | null;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ContributeFragmentSheet({ visible, onClose }: Props) {
  const Dawn = useDawn();
  const styles = useMemo(() => makeStyles(Dawn), [Dawn]);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [place, setPlace] = useState('');
  const [fragmentType, setFragmentType] = useState<FragmentType>(null);
  const [fragmentText, setFragmentText] = useState('');

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const cardTranslateY = useRef(new Animated.Value(10)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.96,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 10,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(1);
      setPlace('');
      setFragmentType(null);
      setFragmentText('');
      onClose();
    });
  };

  const handleBack = () => {
    if (step === 1) {
      handleClose();
      return;
    }
    setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5);
  };

  const handleContinue = () => {
    if (step === 2 && !place.trim()) return;
    if (step === 3 && !fragmentType) return;
    if (step === 4 && !fragmentText.trim()) return;
    if (step < 5) setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
    else handleClose();
  };

  const showProgress = step >= 2 && step <= 4;
  const progressIndex = step - 2;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableWithoutFeedback>
        <View style={styles.modalRoot}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.6],
                }),
              },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>

          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          >
            <Pressable onPress={() => {}} style={styles.cardWrap}>
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardOpacity,
                    transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
                  },
                ]}
              >
                <View style={styles.headerGlow} pointerEvents="none" />
                <View style={styles.header}>
                  <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]} onPress={handleBack}>
                    <Ionicons name="chevron-back" size={24} color={Dawn.text.primary} />
                  </Pressable>
                  <View style={styles.headerContent}>
                    <View style={styles.headerTitleRow}>
                      <Text style={styles.headerTitleEmoji}>🌅</Text>
                      <Text style={styles.headerTitle}>Contribute a Morning Fragment</Text>
                    </View>
                  </View>
                  <Pressable style={({ pressed }) => [styles.dismissBtn, pressed && styles.btnPressed]} onPress={handleClose}>
                    <Text style={styles.dismissIcon}>×</Text>
                  </Pressable>
                </View>

                {showProgress ? (
                  <View style={styles.progressRow}>
                    {Array.from({ length: 3 }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.progressDot,
                          i === progressIndex && styles.progressDotActive,
                          i < progressIndex && styles.progressDotDone,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}

                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.stepContent}>
                    {step === 1 ? (
                      <View style={[styles.stepInner, styles.centeredStep]}>
                        <Text style={styles.intentBodyIntro}>
                          Some ways of meeting the morning have been carried across generations.
                          {'\n'}
                          You can add one from where you are.
                        </Text>
                        <Text style={styles.intentSubtext}>
                          This is about shared traditions, not personal moments.
                        </Text>
                      </View>
                    ) : null}

                    {step === 2 ? (
                      <View style={styles.stepInner}>
                        <Text style={styles.sectionLabel}>Where is this from?</Text>
                        <TextInput
                          style={styles.input}
                          value={place}
                          onChangeText={setPlace}
                          placeholder="City / Region / Community"
                          placeholderTextColor={Dawn.text.secondary}
                          autoCapitalize="words"
                        />
                        <Text style={styles.helper}>Be as specific as you can.</Text>
                      </View>
                    ) : null}

                    {step === 3 ? (
                      <View style={styles.stepInner}>
                        <Text style={styles.sectionLabel}>What kind of fragment is this?</Text>
                        <View style={styles.chipWrap}>
                          {(['Belief', 'Ritual', 'Story', 'Observation'] as const).map((option) => {
                            const selected = fragmentType === option;
                            return (
                              <Pressable
                                key={option}
                                style={({ pressed }) => [
                                  styles.chip,
                                  selected && styles.chipSelected,
                                  pressed && styles.btnPressed,
                                ]}
                                onPress={() => setFragmentType(option)}
                              >
                                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                  {option}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}

                    {step === 4 ? (
                      <View style={styles.stepInner}>
                        <Text style={styles.sectionLabel}>What is known or practiced?</Text>
                        <TextInput
                          style={[styles.input, styles.textArea]}
                          value={fragmentText}
                          onChangeText={setFragmentText}
                          placeholder="Describe the belief, ritual, or way of understanding sunrise."
                          placeholderTextColor={Dawn.text.secondary}
                          multiline
                          numberOfLines={5}
                          textAlignVertical="top"
                        />
                      </View>
                    ) : null}

                    {step === 5 ? (
                      <View style={[styles.stepInner, styles.centeredStep]}>
                        <Text style={styles.thankYouTitle}>Thank you</Text>
                        <Text style={styles.intentBody}>
                          This will be reviewed and may become part of the collection.
                        </Text>
                        <Text style={styles.intentSubtext}>Some things take time to find their place.</Text>
                      </View>
                    ) : null}
                  </View>
                </ScrollView>

                <View style={styles.footer}>
                  {step === 1 ? (
                    <View style={styles.footerRow}>
                      <Pressable style={({ pressed }) => [styles.skipBtn, pressed && styles.btnPressed]} onPress={() => setStep(2)}>
                        <Text style={styles.skipBtnText}>Skip</Text>
                      </Pressable>
                      <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]} onPress={handleContinue}>
                        <Text style={styles.primaryBtnText}>Continue</Text>
                      </Pressable>
                    </View>
                  ) : step === 2 ? (
                    <View style={styles.footerRow}>
                      <Pressable style={({ pressed }) => [styles.skipBtn, pressed && styles.btnPressed]} onPress={() => setStep(3)}>
                        <Text style={styles.skipBtnText}>Skip</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.primaryBtn,
                          !place.trim() && styles.primaryBtnDisabled,
                          pressed && styles.btnPressed,
                        ]}
                        onPress={handleContinue}
                        disabled={!place.trim()}
                      >
                        <Text style={styles.primaryBtnText}>Continue</Text>
                      </Pressable>
                    </View>
                  ) : step === 3 ? (
                    <View style={styles.footerRow}>
                      <Pressable style={({ pressed }) => [styles.skipBtn, pressed && styles.btnPressed]} onPress={handleClose}>
                        <Text style={styles.skipBtnText}>Will share later</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [
                          styles.primaryBtn,
                          !fragmentType && styles.primaryBtnDisabled,
                          pressed && styles.btnPressed,
                        ]}
                        onPress={handleContinue}
                        disabled={!fragmentType}
                      >
                        <Text style={styles.primaryBtnText}>Continue</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        (step === 2 && !place.trim()) && styles.primaryBtnDisabled,
                        (step === 3 && !fragmentType) && styles.primaryBtnDisabled,
                        (step === 4 && !fragmentText.trim()) && styles.primaryBtnDisabled,
                        pressed && styles.btnPressed,
                      ]}
                      onPress={handleContinue}
                      disabled={
                        (step === 2 && !place.trim()) ||
                        (step === 3 && !fragmentType) ||
                        (step === 4 && !fragmentText.trim())
                      }
                    >
                      <Text style={styles.primaryBtnText}>
                        {step === 5 ? 'Done' : step === 4 ? 'Submit' : 'Continue'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000',
    },
    keyboardAvoid: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    cardWrap: {
      width: SCREEN_WIDTH * CARD_WIDTH_RATIO,
      maxWidth: CARD_MAX_WIDTH,
      maxHeight: SCREEN_HEIGHT * CARD_MAX_HEIGHT_RATIO,
      alignSelf: 'center',
    },
    card: {
      width: '100%',
      maxHeight: SCREEN_HEIGHT * CARD_MAX_HEIGHT_RATIO,
      flexDirection: 'column',
      backgroundColor: Dawn.surface.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: Dawn.border.subtle,
      overflow: 'hidden',
    },
    headerGlow: {
      position: 'absolute',
      top: -20,
      left: '10%',
      right: '10%',
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(255,255,255,0.07)',
      opacity: 0.4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 24,
      paddingBottom: 12,
      gap: 8,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    headerContent: {
      flex: 1,
      minWidth: 0,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitleEmoji: {
      fontSize: 22,
      lineHeight: 26,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: '600',
      color: Dawn.text.primary,
      marginBottom: 2,
      letterSpacing: 0.2,
    },
    dismissBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    dismissIcon: {
      fontSize: 24,
      lineHeight: 28,
      color: Dawn.text.primary,
      opacity: 0.7,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      paddingBottom: 20,
      gap: 8,
    },
    progressDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Dawn.border.subtle,
    },
    progressDotActive: {
      backgroundColor: Dawn.accent.sunrise,
      transform: [{ scale: 1.2 }],
    },
    progressDotDone: {
      backgroundColor: Dawn.accent.sunrise,
      opacity: 0.6,
    },
    scrollView: {
      maxHeight: SCREEN_HEIGHT * CARD_MAX_HEIGHT_RATIO * 0.55,
    },
    scrollContent: {
      flexGrow: 0,
    },
    stepContent: {
      paddingHorizontal: 24,
      paddingTop: 4,
      paddingBottom: 8,
    },
    stepInner: {
      paddingBottom: 4,
    },
    centeredStep: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 180,
      paddingVertical: 20,
      paddingHorizontal: 20,
    },
    intentTitle: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '600',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: Dawn.text.secondary,
      opacity: 0.92,
      marginBottom: 14,
    },
    thankYouTitle: {
      fontSize: 22,
      lineHeight: 30,
      fontWeight: '600',
      color: Dawn.text.primary,
      marginBottom: 10,
    },
    intentBody: {
      fontSize: 17,
      lineHeight: 28,
      color: Dawn.text.primary,
      textAlign: 'center',
      opacity: 0.95,
      marginBottom: 10,
    },
    intentBodyIntro: {
      fontSize: 17,
      lineHeight: 28,
      color: Dawn.text.primary,
      textAlign: 'left',
      opacity: 0.95,
      marginBottom: 10,
      alignSelf: 'stretch',
    },
    intentSubtext: {
      fontSize: 12,
      lineHeight: 18,
      color: Dawn.text.secondary,
      textAlign: 'center',
      opacity: 0.78,
      fontStyle: 'italic',
    },
    sectionLabel: {
      fontSize: 17,
      fontWeight: '500',
      color: Dawn.text.primary,
      marginBottom: 12,
    },
    input: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Dawn.border.subtle,
      backgroundColor: Dawn.background.primary,
      color: Dawn.text.primary,
      fontSize: 16,
      marginBottom: 8,
    },
    textArea: {
      minHeight: 88,
      lineHeight: 22,
    },
    helper: {
      fontSize: 12,
      color: Dawn.text.secondary,
      fontStyle: 'italic',
      opacity: 0.78,
      marginBottom: 18,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Dawn.border.subtle,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: 'rgba(255,255,255,0.02)',
    },
    chipSelected: {
      borderColor: Dawn.accent.sunrise,
      backgroundColor: 'rgba(255,179,71,0.14)',
    },
    chipText: {
      color: Dawn.text.secondary,
      fontSize: 15,
      fontWeight: '500',
    },
    chipTextSelected: {
      color: Dawn.accent.sunrise,
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Dawn.border.subtle,
      backgroundColor: Dawn.surface.card,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 16,
    },
    skipBtn: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    skipBtnText: {
      fontSize: 15,
      fontWeight: '500',
      color: Dawn.text.secondary,
    },
    primaryBtn: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 999,
      backgroundColor: Dawn.accent.sunrise,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-end',
    },
    primaryBtnDisabled: {
      opacity: 0.45,
    },
    primaryBtnText: {
      color: Dawn.accent.sunriseOn,
      fontWeight: '600',
      fontSize: 15,
    },
    btnPressed: {
      opacity: 0.85,
    },
  });
}

