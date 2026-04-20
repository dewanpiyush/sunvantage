import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useDawn } from '@/hooks/use-dawn';

export type MorningFragmentIllustrationType = 'pyramidEgypt' | 'gateIndia' | 'sunpathJapan' | 'blueHour';
type MorningFragmentAccent = 'sand' | 'saffron' | 'mist';
type MorningFragmentMotif = 'pyramid' | 'gate' | 'sunpath' | 'blueHour';

type MorningFragmentCardProps = {
  title: string;
  body: string;
  illustrationType?: MorningFragmentIllustrationType;
};

const ACCENT_COLOR: Record<MorningFragmentAccent, string> = {
  sand: '#C2A574',
  saffron: '#B98B4F',
  mist: '#9BAFC2',
};

export default function MorningFragmentCard({
  title,
  body,
  illustrationType = 'pyramidEgypt',
}: MorningFragmentCardProps) {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const accentByType: Record<MorningFragmentIllustrationType, MorningFragmentAccent> = {
    pyramidEgypt: 'sand',
    gateIndia: 'saffron',
    sunpathJapan: 'mist',
    blueHour: 'mist',
  };
  const motifByType: Record<MorningFragmentIllustrationType, MorningFragmentMotif> = {
    pyramidEgypt: 'pyramid',
    gateIndia: 'gate',
    sunpathJapan: 'sunpath',
    blueHour: 'blueHour',
  };
  const accent = accentByType[illustrationType];
  const motif = motifByType[illustrationType];
  const lineColor = ACCENT_COLOR[accent];

  return (
    <View style={styles.card}>
      <View style={styles.visualArea}>
        <FragmentIllustration motif={motif} lineColor={lineColor} />
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.body} numberOfLines={3}>
        {body}
      </Text>
    </View>
  );
}

function FragmentIllustration({
  motif,
  lineColor,
}: {
  motif: MorningFragmentMotif;
  lineColor: string;
}) {
  return (
    <View style={stylesIllustration.root}>
      {/* Shared horizon cues — gate / blue-hour use fully custom compositions. */}
      {motif !== 'gate' && motif !== 'blueHour' ? (
        <>
          <LinearGradient
            colors={['rgba(194,165,116,0)', 'rgba(194,165,116,0.06)', 'rgba(194,165,116,0)']}
            locations={[0, 0.58, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.horizonBand}
            pointerEvents="none"
          />
          <View style={[stylesIllustration.horizon, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.horizonSecondary, { borderColor: lineColor }]} />
        </>
      ) : null}

      {motif === 'pyramid' ? (
        <>
          {/* Ground hint: anchors forms to place. */}
          <LinearGradient
            colors={['rgba(7,16,30,0)', 'rgba(7,16,30,0.34)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.groundPlane}
            pointerEvents="none"
          />

          {/* Solid minimal pyramids: recognizable, matte, low-opacity gold. */}
          <View style={stylesIllustration.heroPyramidFeather} />
          <View style={stylesIllustration.heroPyramid} />
          <View style={stylesIllustration.secondaryPyramidFeather} />
          <View style={stylesIllustration.secondaryPyramid} />

          {/* Alignment line from hero apex toward sunrise point. */}
          <View style={[stylesIllustration.alignmentLine, { borderColor: lineColor }]} />

          {/* Alignment moment: sun touches apex exactly, with a tiny sacred glow. */}
          <View style={[stylesIllustration.sunAligned, { borderColor: lineColor }]} />
          <View style={stylesIllustration.intersectionGlow} />

          {/* Extremely subtle atmospheric depth cue. */}
          <LinearGradient
            colors={['rgba(255,255,255,0.03)', 'rgba(255,255,255,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.haze}
            pointerEvents="none"
          />
        </>
      ) : null}

      {motif === 'gate' ? (
        <>
          {/* Sky ~60%: dark navy, lightening toward horizon */}
          <LinearGradient
            colors={['#0A1424', '#0E1C32', '#152A45']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.templeSky}
            pointerEvents="none"
          />
          {/* Ground ~40%: flatter, darker */}
          <LinearGradient
            colors={['rgba(5,10,18,0.92)', 'rgba(4,8,14,0.98)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.templeGround}
            pointerEvents="none"
          />
          {/* Horizon separation + haze band */}
          <View style={[stylesIllustration.templeHorizonLine, { borderTopColor: lineColor }]} />
          <LinearGradient
            colors={['rgba(148,170,198,0)', 'rgba(148,170,198,0.08)', 'rgba(148,170,198,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.templeHorizonHaze}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={stylesIllustration.templeCorridorHaze}
            pointerEvents="none"
          />

          {/* Sun in sky, slightly above horizon — not touching line */}
          <View style={stylesIllustration.templeSunHalo} />
          <View style={[stylesIllustration.templeSunDisk, { borderColor: lineColor }]} />

          {/* Narrow beam + floor glow (behind door outlines) */}
          <LinearGradient
            colors={['rgba(194,165,116,0)', 'rgba(194,165,116,0.16)', 'rgba(194,165,116,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={stylesIllustration.templeSunBeamGlow}
            pointerEvents="none"
          />
          <View style={[stylesIllustration.templeSunBeam, { borderColor: lineColor }]} />
          <LinearGradient
            colors={['rgba(194,165,116,0)', 'rgba(194,165,116,0.11)', 'rgba(194,165,116,0.05)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={stylesIllustration.templeFloorLit}
            pointerEvents="none"
          />
          <View style={[stylesIllustration.templeShadowNear, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeShadowMid, { borderColor: lineColor }]} />

          {/* Frames: far (faint) → mid → near (strong) */}
          <View style={[stylesIllustration.templeFrameFarLeft, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeFrameFarRight, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeFrameFarTop, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeFrameMidLeft, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeFrameMidRight, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeFrameMidTop, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeFrameNearLeft, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeFrameNearRight, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.templeFrameNearTop, { borderColor: lineColor }]} />
        </>
      ) : null}

      {motif === 'blueHour' ? (
        <>
          {/* Blue hour: gradient-only sky, still; light scattering — no birds or motion cues. */}
          <LinearGradient
            colors={['#060D18', '#0C1A2E', '#153A5C', '#2E5F85', '#6FA3C8', '#B8D4E8']}
            locations={[0, 0.22, 0.42, 0.58, 0.78, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.blueHourSky}
            pointerEvents="none"
          />
          {/* Upper sky: slightly cooler depth (Rayleigh scattering feel). */}
          <LinearGradient
            colors={['rgba(8,20,40,0.55)', 'rgba(8,20,40,0)', 'rgba(8,20,40,0)']}
            locations={[0, 0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.blueHourUpperCool}
            pointerEvents="none"
          />
          {/* Sparse stars — fade toward horizon; very subtle. */}
          <View style={stylesIllustration.blueHourStar1} />
          <View style={stylesIllustration.blueHourStar2} />
          <View style={stylesIllustration.blueHourStar3} />
          <View style={stylesIllustration.blueHourStar4} />
          <View style={stylesIllustration.blueHourStar5} />
          {/* Atmospheric diffusion near horizon (haze). */}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(200, 220, 240, 0.12)', 'rgba(255,255,255,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.blueHourHazeBand}
            pointerEvents="none"
          />
          {/* Pre-sunrise glow along horizon — soft, not a sun disk. */}
          <LinearGradient
            colors={['rgba(180, 210, 235, 0)', 'rgba(200, 230, 250, 0.35)', 'rgba(180, 210, 235, 0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={stylesIllustration.blueHourHorizonGlow}
            pointerEvents="none"
          />
          {/* Very soft horizon line (no hard contrast). */}
          <View style={[stylesIllustration.blueHourHorizonHairline, { borderTopColor: lineColor }]} />
          {/* Distant land/water silhouette — minimal, low contrast. */}
          <LinearGradient
            colors={['rgba(4,6,12,0)', 'rgba(4,8,14,0.55)', 'rgba(3,6,10,0.92)']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.blueHourGround}
            pointerEvents="none"
          />
          <View style={stylesIllustration.blueHourLandSilhouette} />
        </>
      ) : null}

      {motif === 'sunpath' ? (
        <>
          {/* Dawn chorus: horizon-separated sky/ground + first light cue + minimal bird marks. */}
          <LinearGradient
            colors={['#0A1424', '#0E1C32', '#152A45']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.chorusSky}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(5,10,18,0.92)', 'rgba(4,8,14,0.98)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.chorusGround}
            pointerEvents="none"
          />
          <View style={[stylesIllustration.chorusHorizonLine, { borderTopColor: lineColor }]} />
          <LinearGradient
            colors={['rgba(148,170,198,0)', 'rgba(148,170,198,0.07)', 'rgba(148,170,198,0)']}
            locations={[0, 0.52, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesIllustration.chorusHorizonHaze}
            pointerEvents="none"
          />

          {/* First light band: faint warm spread along horizon. */}
          <LinearGradient
            colors={['rgba(194,165,116,0)', 'rgba(194,165,116,0.10)', 'rgba(194,165,116,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={stylesIllustration.chorusFirstLightBand}
            pointerEvents="none"
          />

          {/* Sun: dim, barely touching horizon (pre-sunrise / first light). */}
          <View style={stylesIllustration.chorusSunHalo} />
          <View style={[stylesIllustration.chorusSunDisk, { borderColor: lineColor }]} />

          {/* Birds: minimal arcs, distributed, slightly varied. */}
          <View style={[stylesIllustration.chorusBirdA, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.chorusBirdB, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.chorusBirdC, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.chorusBirdD, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.chorusBirdE, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.chorusBirdF, { borderColor: lineColor }]} />

          {/* Subtle sound-wave hints (quiet activation). */}
          <View style={[stylesIllustration.chorusWave1, { borderColor: lineColor }]} />
          <View style={[stylesIllustration.chorusWave2, { borderColor: lineColor }]} />
        </>
      ) : null}
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
    card: {
      backgroundColor: Dawn.surface.cardSecondary,
      borderRadius: 15,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 18,
      overflow: 'hidden',
    },
    visualArea: {
      height: 128,
      borderRadius: 10,
      overflow: 'hidden',
      alignSelf: 'stretch',
      marginBottom: 12,
      backgroundColor: '#0F1B2D',
    },
    title: {
      marginTop: 0,
      marginBottom: 8,
      fontSize: 11.5,
      lineHeight: 16,
      fontWeight: '600',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: Dawn.text.secondary,
      opacity: 0.86,
      textAlign: 'left',
    },
    body: {
      fontSize: 14.5,
      lineHeight: 22,
      color: Dawn.text.primary,
      textAlign: 'left',
      opacity: 0.95,
    },
  });
}

const stylesIllustration = StyleSheet.create({
  root: {
    flex: 1,
  },
  horizon: {
    position: 'absolute',
    left: 12,
    right: 16,
    bottom: 44,
    borderTopWidth: 1.2,
    opacity: 0.9,
    transform: [{ rotate: '-0.6deg' }],
  },
  horizonSecondary: {
    position: 'absolute',
    left: 36,
    right: 60,
    bottom: 43,
    borderTopWidth: 0.8,
    opacity: 0.42,
    transform: [{ rotate: '0.35deg' }],
  },
  horizonBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 32,
    height: 24,
  },
  groundPlane: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  heroPyramid: {
    position: 'absolute',
    left: 128,
    bottom: 45,
    width: 0,
    height: 0,
    borderLeftWidth: 33,
    borderRightWidth: 31,
    borderBottomWidth: 46,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(212,175,55,0.27)',
    transform: [{ rotate: '-0.8deg' }],
  },
  heroPyramidFeather: {
    position: 'absolute',
    left: 127,
    bottom: 44,
    width: 0,
    height: 0,
    borderLeftWidth: 34,
    borderRightWidth: 32,
    borderBottomWidth: 47,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(212,175,55,0.08)',
    transform: [{ rotate: '-0.8deg' }],
  },
  secondaryPyramid: {
    position: 'absolute',
    left: 82,
    bottom: 45,
    width: 0,
    height: 0,
    borderLeftWidth: 24,
    borderRightWidth: 22,
    borderBottomWidth: 33,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(212,175,55,0.2)',
    transform: [{ rotate: '0.7deg' }],
  },
  secondaryPyramidFeather: {
    position: 'absolute',
    left: 81,
    bottom: 44,
    width: 0,
    height: 0,
    borderLeftWidth: 25,
    borderRightWidth: 23,
    borderBottomWidth: 34,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(212,175,55,0.07)',
    transform: [{ rotate: '0.7deg' }],
  },
  alignmentLine: {
    position: 'absolute',
    left: 160,
    right: 56,
    bottom: 73,
    borderTopWidth: 0.8,
    transform: [{ rotate: '-4deg' }],
    opacity: 0.36,
  },
  sunAligned: {
    position: 'absolute',
    right: 35,
    bottom: 56,
    width: 15,
    height: 15,
    borderWidth: 1,
    borderRadius: 999,
    opacity: 0.9,
  },
  intersectionGlow: {
    position: 'absolute',
    right: 34,
    bottom: 55,
    width: 17,
    height: 17,
    borderRadius: 999,
    backgroundColor: 'rgba(194,165,116,0.18)',
  },
  haze: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 6,
    height: 70,
    opacity: 0.35,
  },
  /** Gate: sky ~60% — dark navy, lightens toward horizon */
  templeSky: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '60%',
  },
  /** Gate: ground ~40% — darker, flatter */
  templeGround: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  templeHorizonLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '60%',
    marginTop: -0.5,
    height: 0,
    borderTopWidth: 0.85,
    opacity: 0.38,
  },
  templeHorizonHaze: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '56%',
    height: 22,
  },
  templeCorridorHaze: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '35%',
    bottom: '22%',
    opacity: 0.85,
  },
  templeFloorLit: {
    position: 'absolute',
    left: 38,
    right: 28,
    bottom: 36,
    height: 10,
  },
  /** Far: small, thin, faint */
  templeFrameFarLeft: {
    position: 'absolute',
    left: 118,
    bottom: 40,
    width: 7,
    height: 18,
    borderWidth: 0.55,
    borderBottomWidth: 0,
    opacity: 0.3,
  },
  templeFrameFarRight: {
    position: 'absolute',
    right: 118,
    bottom: 40,
    width: 7,
    height: 18,
    borderWidth: 0.55,
    borderBottomWidth: 0,
    opacity: 0.3,
  },
  templeFrameFarTop: {
    position: 'absolute',
    left: 117,
    right: 117,
    bottom: 57,
    borderTopWidth: 0.55,
    opacity: 0.28,
  },
  /** Mid */
  templeFrameMidLeft: {
    position: 'absolute',
    left: 98,
    bottom: 40,
    width: 12,
    height: 26,
    borderWidth: 0.85,
    borderBottomWidth: 0,
    opacity: 0.52,
  },
  templeFrameMidRight: {
    position: 'absolute',
    right: 98,
    bottom: 40,
    width: 12,
    height: 26,
    borderWidth: 0.85,
    borderBottomWidth: 0,
    opacity: 0.52,
  },
  templeFrameMidTop: {
    position: 'absolute',
    left: 97,
    right: 97,
    bottom: 65,
    borderTopWidth: 0.85,
    opacity: 0.48,
  },
  /** Near: large, thick, strong */
  templeFrameNearLeft: {
    position: 'absolute',
    left: 72,
    bottom: 40,
    width: 20,
    height: 38,
    borderWidth: 1.15,
    borderBottomWidth: 0,
    opacity: 0.92,
  },
  templeFrameNearRight: {
    position: 'absolute',
    right: 72,
    bottom: 40,
    width: 20,
    height: 38,
    borderWidth: 1.15,
    borderBottomWidth: 0,
    opacity: 0.92,
  },
  templeFrameNearTop: {
    position: 'absolute',
    left: 71,
    right: 71,
    bottom: 77,
    borderTopWidth: 1.2,
    opacity: 0.88,
  },
  /** Narrow beam along floor perspective */
  templeSunBeam: {
    position: 'absolute',
    left: 52,
    right: 38,
    bottom: 44,
    borderTopWidth: 0.75,
    opacity: 0.82,
  },
  templeSunBeamGlow: {
    position: 'absolute',
    left: 40,
    right: 30,
    bottom: 41,
    height: 16,
  },
  /** Soft halo behind sun */
  templeSunHalo: {
    position: 'absolute',
    left: 36,
    bottom: 54,
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(194,165,116,0.14)',
  },
  /** Small sun, slightly above horizon (bottom edge ~5px above horizon at 40%) */
  templeSunDisk: {
    position: 'absolute',
    left: 40,
    bottom: 56,
    width: 7,
    height: 7,
    borderWidth: 1,
    borderRadius: 999,
    opacity: 0.95,
  },
  templeShadowNear: {
    position: 'absolute',
    left: 88,
    right: 62,
    bottom: 36,
    borderTopWidth: 0.65,
    opacity: 0.2,
  },
  templeShadowMid: {
    position: 'absolute',
    left: 108,
    right: 98,
    bottom: 38,
    borderTopWidth: 0.55,
    opacity: 0.14,
  },
  sunCircleLeft: {
    position: 'absolute',
    left: 70,
    bottom: 47,
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: 999,
    opacity: 0.88,
  },
  pathLine: {
    position: 'absolute',
    left: 94,
    right: 42,
    bottom: 59,
    borderTopWidth: 1,
    transform: [{ rotate: '-6deg' }],
    opacity: 0.74,
  },

  // --- Dawn chorus (sunpathJapan) ---
  chorusSky: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '60%',
  },
  chorusGround: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  chorusHorizonLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: '60%',
    marginTop: -0.5,
    height: 0,
    borderTopWidth: 0.85,
    opacity: 0.34,
  },
  chorusHorizonHaze: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '56%',
    height: 22,
  },
  chorusFirstLightBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '58.5%',
    height: 14,
    opacity: 0.75,
  },
  chorusSunHalo: {
    position: 'absolute',
    left: 168,
    top: '58.8%',
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(194,165,116,0.12)',
    opacity: 0.9,
  },
  chorusSunDisk: {
    position: 'absolute',
    left: 172,
    top: '60.2%',
    width: 7,
    height: 7,
    borderWidth: 1,
    borderRadius: 999,
    opacity: 0.72,
  },
  chorusBirdA: {
    position: 'absolute',
    left: 46,
    top: 22,
    width: 14,
    height: 8,
    borderTopWidth: 1,
    borderRadius: 12,
    opacity: 0.52,
    transform: [{ rotate: '-10deg' }],
  },
  chorusBirdB: {
    position: 'absolute',
    left: 86,
    top: 38,
    width: 12,
    height: 7,
    borderTopWidth: 1,
    borderRadius: 12,
    opacity: 0.46,
    transform: [{ rotate: '6deg' }],
  },
  chorusBirdC: {
    position: 'absolute',
    right: 56,
    top: 28,
    width: 13,
    height: 7,
    borderTopWidth: 1,
    borderRadius: 12,
    opacity: 0.5,
    transform: [{ rotate: '12deg' }],
  },
  chorusBirdD: {
    position: 'absolute',
    right: 90,
    top: 54,
    width: 11,
    height: 6,
    borderTopWidth: 1,
    borderRadius: 10,
    opacity: 0.4,
    transform: [{ rotate: '-4deg' }],
  },
  chorusBirdE: {
    position: 'absolute',
    left: 132,
    top: 46,
    width: 10,
    height: 6,
    borderTopWidth: 1,
    borderRadius: 10,
    opacity: 0.38,
    transform: [{ rotate: '2deg' }],
  },
  chorusBirdF: {
    position: 'absolute',
    left: 72,
    top: 64,
    width: 9,
    height: 5,
    borderTopWidth: 1,
    borderRadius: 10,
    opacity: 0.32,
    transform: [{ rotate: '14deg' }],
  },
  chorusWave1: {
    position: 'absolute',
    left: 98,
    top: 34,
    width: 18,
    height: 10,
    borderTopWidth: 0.8,
    borderRadius: 14,
    opacity: 0.18,
    transform: [{ rotate: '-6deg' }],
  },
  chorusWave2: {
    position: 'absolute',
    right: 74,
    top: 46,
    width: 16,
    height: 9,
    borderTopWidth: 0.8,
    borderRadius: 14,
    opacity: 0.16,
    transform: [{ rotate: '8deg' }],
  },

  // --- Blue hour (still sky; light scattering — distinct from dawn chorus) ---
  blueHourSky: {
    ...StyleSheet.absoluteFillObject,
  },
  blueHourUpperCool: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '58%',
  },
  blueHourStar1: {
    position: 'absolute',
    left: '10%',
    top: 16,
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(230, 240, 255, 0.38)',
    opacity: 0.85,
  },
  blueHourStar2: {
    position: 'absolute',
    left: '34%',
    top: 28,
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(230, 240, 255, 0.28)',
    opacity: 0.75,
  },
  blueHourStar3: {
    position: 'absolute',
    right: '26%',
    top: 20,
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(230, 240, 255, 0.32)',
    opacity: 0.8,
  },
  blueHourStar4: {
    position: 'absolute',
    left: '58%',
    top: 12,
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(230, 240, 255, 0.22)',
    opacity: 0.65,
  },
  blueHourStar5: {
    position: 'absolute',
    right: '14%',
    top: 36,
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(230, 240, 255, 0.18)',
    opacity: 0.55,
  },
  blueHourHazeBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '52%',
    height: 36,
  },
  blueHourHorizonGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '61%',
    height: 22,
    opacity: 0.85,
  },
  blueHourHorizonHairline: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: '66.5%',
    borderTopWidth: 0.65,
    opacity: 0.22,
  },
  blueHourGround: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '34%',
  },
  /** Minimal distant silhouette — reads as land/water, not a focal object. */
  blueHourLandSilhouette: {
    position: 'absolute',
    left: -8,
    right: -8,
    bottom: 0,
    height: 14,
    backgroundColor: 'rgba(2, 5, 10, 0.55)',
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    opacity: 0.65,
  },
});

