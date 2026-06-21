import Aura from '@primeuix/themes/aura';
import type { PrimeNGConfigType } from 'primeng/config';
import { definePreset } from '@primeuix/themes';

const SparkFlowAura = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
  },
  components: {
    button: {
      root: {
        label: {
          fontWeight: '600',
        },
      },
    },
  },
});

export const sparkFlowPrimeNgConfig = {
  ripple: true,
  inputVariant: 'outlined',
  overlayAppendTo: 'body',
  zIndex: {
    modal: 1200,
    overlay: 1100,
    menu: 1000,
    tooltip: 1300,
  },
  theme: {
    preset: SparkFlowAura,
    options: {
      darkModeSelector: '.sparkflow-dark',
      prefix: 'p',
    },
  },
} satisfies PrimeNGConfigType;
