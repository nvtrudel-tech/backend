import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

// Import your translation files
// You'll need to create this 'translations' folder
import en from '../translations/en.json';
import fr from '../translations/fr.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    // Detect device language
    lng: Localization.getLocales()[0].languageCode || 'en', 
    fallbackLng: 'en', // Use 'en' if detected language is not available
    compatibilityJSON: 'v3', // For React Native
    interpolation: {
      escapeValue: false, // react is already safe from xss
    },
  });

export default i18n;
