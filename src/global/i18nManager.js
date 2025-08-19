/**
 * Internationalization Manager
 * Handles multi-language support, localization, and cultural adaptations
 */

const { EventEmitter } = require('events');
const { Logger } = require('../utils/logger');

class I18nManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.logger = new Logger({ component: 'I18nManager' });
    this.config = {
      defaultLocale: 'en-US',
      supportedLocales: [
        'en-US', // English (United States)
        'en-GB', // English (United Kingdom)
        'es-ES', // Spanish (Spain)
        'es-MX', // Spanish (Mexico)
        'fr-FR', // French (France)
        'fr-CA', // French (Canada)
        'de-DE', // German (Germany)
        'ja-JP', // Japanese (Japan)
        'zh-CN', // Chinese (Simplified)
        'zh-TW', // Chinese (Traditional)
        'ko-KR', // Korean
        'pt-BR', // Portuguese (Brazil)
        'it-IT', // Italian
        'ru-RU', // Russian
        'ar-SA', // Arabic (Saudi Arabia)
        'hi-IN', // Hindi (India)
        'th-TH', // Thai
        'vi-VN', // Vietnamese
        'tr-TR', // Turkish
        'pl-PL', // Polish
        'nl-NL', // Dutch
      ],
      fallbackChain: {
        'es-MX': ['es-ES', 'en-US'],
        'fr-CA': ['fr-FR', 'en-US'],
        'zh-TW': ['zh-CN', 'en-US'],
        'en-GB': ['en-US'],
      },
      culturalAdaptations: {
        dateFormats: true,
        numberFormats: true,
        currencyFormats: true,
        timeZones: true,
        rtlSupport: true,
        colorCoding: true,
      },
      contentAdaptation: {
        autoTranslation: true,
        contextualTranslation: true,
        technicalTerms: true,
        culturalSensitivity: true,
      },
      caching: {
        enabled: true,
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 10000, // 10k translations
      },
      ...config,
    };

    // Translation storage and caching
    this.translations = new Map();
    this.translationCache = new Map();
    this.contextualTranslations = new Map();
    this.pluralizationRules = new Map();
    this.culturalRules = new Map();

    // Language detection and preferences
    this.localeDetectors = new Map();
    this.userPreferences = new Map();
    this.contentAdaptations = new Map();

    // Metrics and analytics
    this.metrics = {
      translationRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      fallbackUsage: 0,
      missingTranslations: 0,
      localeDetections: new Map(),
      contentAdaptations: new Map(),
    };

    this.initialized = false;
  }

  async initialize() {
    this.logger.info('Initializing I18n Manager...');

    // Load core translations
    await this.loadCoreTranslations();

    // Setup pluralization rules
    this.setupPluralizationRules();

    // Setup cultural adaptations
    this.setupCulturalAdaptations();

    // Initialize locale detectors
    this.initializeLocaleDetectors();

    // Setup content adaptation rules
    this.setupContentAdaptationRules();

    // Start cache management
    this.startCacheManagement();

    this.initialized = true;
    this.logger.info(
      `I18n Manager initialized with ${this.config.supportedLocales.length} locales`
    );

    return this;
  }

  async loadCoreTranslations() {
    // Core system translations
    const coreTranslations = {
      'en-US': {
        'system.error.general': 'An error occurred',
        'system.error.network': 'Network connection failed',
        'system.error.auth': 'Authentication failed',
        'system.error.permission': 'Permission denied',
        'system.success.operation': 'Operation completed successfully',
        'system.loading': 'Loading...',
        'system.retry': 'Retry',
        'system.cancel': 'Cancel',
        'system.confirm': 'Confirm',
        'llm.provider.openai': 'OpenAI',
        'llm.provider.anthropic': 'Anthropic',
        'llm.provider.azure': 'Azure OpenAI',
        'llm.metrics.cost': 'Cost',
        'llm.metrics.tokens': 'Tokens',
        'llm.metrics.latency': 'Response Time',
        'llm.metrics.accuracy': 'Accuracy',
        'dashboard.overview': 'Overview',
        'dashboard.metrics': 'Metrics',
        'dashboard.traces': 'Traces',
        'dashboard.alerts': 'Alerts',
        'dashboard.settings': 'Settings',
      },
      'es-ES': {
        'system.error.general': 'Se produjo un error',
        'system.error.network': 'Falló la conexión de red',
        'system.error.auth': 'Falló la autenticación',
        'system.error.permission': 'Permiso denegado',
        'system.success.operation': 'Operación completada exitosamente',
        'system.loading': 'Cargando...',
        'system.retry': 'Reintentar',
        'system.cancel': 'Cancelar',
        'system.confirm': 'Confirmar',
        'llm.provider.openai': 'OpenAI',
        'llm.provider.anthropic': 'Anthropic',
        'llm.provider.azure': 'Azure OpenAI',
        'llm.metrics.cost': 'Coste',
        'llm.metrics.tokens': 'Tokens',
        'llm.metrics.latency': 'Tiempo de Respuesta',
        'llm.metrics.accuracy': 'Precisión',
        'dashboard.overview': 'Resumen',
        'dashboard.metrics': 'Métricas',
        'dashboard.traces': 'Trazas',
        'dashboard.alerts': 'Alertas',
        'dashboard.settings': 'Configuración',
      },
      'fr-FR': {
        'system.error.general': "Une erreur s'est produite",
        'system.error.network': 'Échec de la connexion réseau',
        'system.error.auth': "Échec de l'authentification",
        'system.error.permission': 'Permission refusée',
        'system.success.operation': 'Opération terminée avec succès',
        'system.loading': 'Chargement...',
        'system.retry': 'Réessayer',
        'system.cancel': 'Annuler',
        'system.confirm': 'Confirmer',
        'llm.provider.openai': 'OpenAI',
        'llm.provider.anthropic': 'Anthropic',
        'llm.provider.azure': 'Azure OpenAI',
        'llm.metrics.cost': 'Coût',
        'llm.metrics.tokens': 'Jetons',
        'llm.metrics.latency': 'Temps de Réponse',
        'llm.metrics.accuracy': 'Précision',
        'dashboard.overview': 'Aperçu',
        'dashboard.metrics': 'Métriques',
        'dashboard.traces': 'Traces',
        'dashboard.alerts': 'Alertes',
        'dashboard.settings': 'Paramètres',
      },
      'de-DE': {
        'system.error.general': 'Ein Fehler ist aufgetreten',
        'system.error.network': 'Netzwerkverbindung fehlgeschlagen',
        'system.error.auth': 'Authentifizierung fehlgeschlagen',
        'system.error.permission': 'Berechtigung verweigert',
        'system.success.operation': 'Operation erfolgreich abgeschlossen',
        'system.loading': 'Laden...',
        'system.retry': 'Wiederholen',
        'system.cancel': 'Abbrechen',
        'system.confirm': 'Bestätigen',
        'llm.provider.openai': 'OpenAI',
        'llm.provider.anthropic': 'Anthropic',
        'llm.provider.azure': 'Azure OpenAI',
        'llm.metrics.cost': 'Kosten',
        'llm.metrics.tokens': 'Token',
        'llm.metrics.latency': 'Antwortzeit',
        'llm.metrics.accuracy': 'Genauigkeit',
        'dashboard.overview': 'Übersicht',
        'dashboard.metrics': 'Metriken',
        'dashboard.traces': 'Traces',
        'dashboard.alerts': 'Benachrichtigungen',
        'dashboard.settings': 'Einstellungen',
      },
      'ja-JP': {
        'system.error.general': 'エラーが発生しました',
        'system.error.network': 'ネットワーク接続に失敗しました',
        'system.error.auth': '認証に失敗しました',
        'system.error.permission': 'アクセス権限がありません',
        'system.success.operation': '操作が正常に完了しました',
        'system.loading': '読み込み中...',
        'system.retry': '再試行',
        'system.cancel': 'キャンセル',
        'system.confirm': '確認',
        'llm.provider.openai': 'OpenAI',
        'llm.provider.anthropic': 'Anthropic',
        'llm.provider.azure': 'Azure OpenAI',
        'llm.metrics.cost': 'コスト',
        'llm.metrics.tokens': 'トークン',
        'llm.metrics.latency': '応答時間',
        'llm.metrics.accuracy': '精度',
        'dashboard.overview': '概要',
        'dashboard.metrics': 'メトリクス',
        'dashboard.traces': 'トレース',
        'dashboard.alerts': 'アラート',
        'dashboard.settings': '設定',
      },
      'zh-CN': {
        'system.error.general': '发生错误',
        'system.error.network': '网络连接失败',
        'system.error.auth': '身份验证失败',
        'system.error.permission': '权限被拒绝',
        'system.success.operation': '操作成功完成',
        'system.loading': '加载中...',
        'system.retry': '重试',
        'system.cancel': '取消',
        'system.confirm': '确认',
        'llm.provider.openai': 'OpenAI',
        'llm.provider.anthropic': 'Anthropic',
        'llm.provider.azure': 'Azure OpenAI',
        'llm.metrics.cost': '成本',
        'llm.metrics.tokens': '令牌',
        'llm.metrics.latency': '响应时间',
        'llm.metrics.accuracy': '准确性',
        'dashboard.overview': '概述',
        'dashboard.metrics': '指标',
        'dashboard.traces': '跟踪',
        'dashboard.alerts': '警报',
        'dashboard.settings': '设置',
      },
    };

    // Load translations into memory
    for (const [locale, translations] of Object.entries(coreTranslations)) {
      this.translations.set(locale, new Map(Object.entries(translations)));
    }

    this.logger.info(
      `Loaded core translations for ${Object.keys(coreTranslations).length} locales`
    );
  }

  setupPluralizationRules() {
    // English and similar languages (0, 1, 2+)
    const englishRule = count => {
      if (count === 0) return 'zero';
      if (count === 1) return 'one';
      return 'other';
    };

    // Romance languages (0, 1, 2+)
    const romanceRule = count => {
      if (count === 0 || count === 1) return 'one';
      return 'other';
    };

    // Slavic languages (complex rules)
    const slavicRule = count => {
      const mod10 = count % 10;
      const mod100 = count % 100;

      if (mod10 === 1 && mod100 !== 11) return 'one';
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
        return 'few';
      return 'many';
    };

    // Japanese, Korean, Chinese (no pluralization)
    const noPlural = () => 'other';

    // Arabic (complex 6-form system)
    const arabicRule = count => {
      if (count === 0) return 'zero';
      if (count === 1) return 'one';
      if (count === 2) return 'two';
      if (count % 100 >= 3 && count % 100 <= 10) return 'few';
      if (count % 100 >= 11 && count % 100 <= 99) return 'many';
      return 'other';
    };

    // Map locales to pluralization rules
    const localeRules = {
      'en-US': englishRule,
      'en-GB': englishRule,
      'es-ES': romanceRule,
      'es-MX': romanceRule,
      'fr-FR': romanceRule,
      'fr-CA': romanceRule,
      'it-IT': romanceRule,
      'pt-BR': romanceRule,
      'de-DE': englishRule,
      'nl-NL': englishRule,
      'pl-PL': slavicRule,
      'ru-RU': slavicRule,
      'ja-JP': noPlural,
      'ko-KR': noPlural,
      'zh-CN': noPlural,
      'zh-TW': noPlural,
      'th-TH': noPlural,
      'vi-VN': noPlural,
      'ar-SA': arabicRule,
      'hi-IN': englishRule,
      'tr-TR': englishRule,
    };

    for (const [locale, rule] of Object.entries(localeRules)) {
      this.pluralizationRules.set(locale, rule);
    }

    this.logger.info(
      'Pluralization rules configured for all supported locales'
    );
  }

  setupCulturalAdaptations() {
    // Date and time formats
    const dateFormats = new Map([
      [
        'en-US',
        { date: 'MM/DD/YYYY', time: 'h:mm A', datetime: 'MM/DD/YYYY h:mm A' },
      ],
      [
        'en-GB',
        { date: 'DD/MM/YYYY', time: 'HH:mm', datetime: 'DD/MM/YYYY HH:mm' },
      ],
      [
        'es-ES',
        { date: 'DD/MM/YYYY', time: 'HH:mm', datetime: 'DD/MM/YYYY HH:mm' },
      ],
      [
        'fr-FR',
        { date: 'DD/MM/YYYY', time: 'HH:mm', datetime: 'DD/MM/YYYY HH:mm' },
      ],
      [
        'de-DE',
        { date: 'DD.MM.YYYY', time: 'HH:mm', datetime: 'DD.MM.YYYY HH:mm' },
      ],
      [
        'ja-JP',
        { date: 'YYYY/MM/DD', time: 'HH:mm', datetime: 'YYYY/MM/DD HH:mm' },
      ],
      [
        'zh-CN',
        { date: 'YYYY-MM-DD', time: 'HH:mm', datetime: 'YYYY-MM-DD HH:mm' },
      ],
    ]);

    // Number formats
    const numberFormats = new Map([
      ['en-US', { decimal: '.', thousands: ',', currency: '$' }],
      ['en-GB', { decimal: '.', thousands: ',', currency: '£' }],
      ['es-ES', { decimal: ',', thousands: '.', currency: '€' }],
      ['fr-FR', { decimal: ',', thousands: ' ', currency: '€' }],
      ['de-DE', { decimal: ',', thousands: '.', currency: '€' }],
      ['ja-JP', { decimal: '.', thousands: ',', currency: '¥' }],
      ['zh-CN', { decimal: '.', thousands: ',', currency: '¥' }],
    ]);

    // RTL languages
    const rtlLanguages = new Set(['ar-SA', 'he-IL', 'fa-IR', 'ur-PK']);

    // Color coding cultural meanings
    const colorMeanings = new Map([
      [
        'en-US',
        { success: 'green', warning: 'yellow', error: 'red', info: 'blue' },
      ],
      [
        'zh-CN',
        { success: 'red', warning: 'yellow', error: 'black', info: 'blue' },
      ],
      [
        'ja-JP',
        { success: 'green', warning: 'yellow', error: 'red', info: 'blue' },
      ],
    ]);

    this.culturalRules.set('dateFormats', dateFormats);
    this.culturalRules.set('numberFormats', numberFormats);
    this.culturalRules.set('rtlLanguages', rtlLanguages);
    this.culturalRules.set('colorMeanings', colorMeanings);

    this.logger.info('Cultural adaptation rules configured');
  }

  initializeLocaleDetectors() {
    // Browser locale detector
    this.localeDetectors.set('browser', request => {
      const acceptLanguage = request.headers?.['accept-language'];
      if (!acceptLanguage) return null;

      const languages = acceptLanguage
        .split(',')
        .map(lang => {
          const [locale, q = '1'] = lang.trim().split(';q=');
          return { locale: locale.trim(), quality: parseFloat(q) };
        })
        .sort((a, b) => b.quality - a.quality);

      for (const { locale } of languages) {
        if (this.config.supportedLocales.includes(locale)) {
          return locale;
        }
        // Try to find similar locale (e.g., 'en' -> 'en-US')
        const similar = this.config.supportedLocales.find(supported =>
          supported.startsWith(locale.split('-')[0])
        );
        if (similar) return similar;
      }

      return null;
    });

    // User preference detector
    this.localeDetectors.set('user', request => {
      const userId = request.user?.id;
      if (userId && this.userPreferences.has(userId)) {
        return this.userPreferences.get(userId).locale;
      }
      return null;
    });

    // Geographic detector
    this.localeDetectors.set('geographic', request => {
      const country = request.geo?.country;
      const geoMapping = {
        US: 'en-US',
        GB: 'en-GB',
        CA: 'en-US',
        ES: 'es-ES',
        MX: 'es-MX',
        AR: 'es-ES',
        FR: 'fr-FR',
        DE: 'de-DE',
        IT: 'it-IT',
        JP: 'ja-JP',
        CN: 'zh-CN',
        TW: 'zh-TW',
        KR: 'ko-KR',
        BR: 'pt-BR',
        RU: 'ru-RU',
        SA: 'ar-SA',
        IN: 'hi-IN',
        TH: 'th-TH',
        VN: 'vi-VN',
        TR: 'tr-TR',
        PL: 'pl-PL',
        NL: 'nl-NL',
      };
      return geoMapping[country] || null;
    });

    this.logger.info('Locale detectors initialized');
  }

  setupContentAdaptationRules() {
    // Technical term translations
    const technicalTerms = new Map([
      [
        'en-US',
        new Map([
          ['API', 'API'],
          ['token', 'token'],
          ['latency', 'latency'],
          ['throughput', 'throughput'],
          ['cache', 'cache'],
        ]),
      ],
      [
        'es-ES',
        new Map([
          ['API', 'API'],
          ['token', 'token'],
          ['latency', 'latencia'],
          ['throughput', 'rendimiento'],
          ['cache', 'caché'],
        ]),
      ],
      [
        'fr-FR',
        new Map([
          ['API', 'API'],
          ['token', 'jeton'],
          ['latency', 'latence'],
          ['throughput', 'débit'],
          ['cache', 'cache'],
        ]),
      ],
      [
        'de-DE',
        new Map([
          ['API', 'API'],
          ['token', 'Token'],
          ['latency', 'Latenz'],
          ['throughput', 'Durchsatz'],
          ['cache', 'Cache'],
        ]),
      ],
      [
        'ja-JP',
        new Map([
          ['API', 'API'],
          ['token', 'トークン'],
          ['latency', 'レイテンシ'],
          ['throughput', 'スループット'],
          ['cache', 'キャッシュ'],
        ]),
      ],
      [
        'zh-CN',
        new Map([
          ['API', 'API'],
          ['token', '令牌'],
          ['latency', '延迟'],
          ['throughput', '吞吐量'],
          ['cache', '缓存'],
        ]),
      ],
    ]);

    this.contentAdaptations.set('technicalTerms', technicalTerms);

    this.logger.info('Content adaptation rules configured');
  }

  startCacheManagement() {
    if (!this.config.caching.enabled) return;

    // Cache cleanup interval
    setInterval(
      () => {
        this.cleanupTranslationCache();
      },
      60 * 60 * 1000
    ); // Every hour

    this.logger.info('Translation cache management started');
  }

  detectLocale(request) {
    this.metrics.localeDetections.set(
      'total',
      (this.metrics.localeDetections.get('total') || 0) + 1
    );

    // Try detectors in order of priority
    const detectorOrder = ['user', 'browser', 'geographic'];

    for (const detectorName of detectorOrder) {
      const detector = this.localeDetectors.get(detectorName);
      if (detector) {
        try {
          const locale = detector(request);
          if (locale) {
            this.metrics.localeDetections.set(
              detectorName,
              (this.metrics.localeDetections.get(detectorName) || 0) + 1
            );
            return locale;
          }
        } catch (error) {
          this.logger.warn(`Locale detector ${detectorName} failed:`, error);
        }
      }
    }

    // Fallback to default locale
    this.metrics.localeDetections.set(
      'fallback',
      (this.metrics.localeDetections.get('fallback') || 0) + 1
    );
    return this.config.defaultLocale;
  }

  translate(key, locale = this.config.defaultLocale, options = {}) {
    this.metrics.translationRequests++;

    const { count, context, interpolations = {} } = options;
    const cacheKey = `${locale}:${key}:${JSON.stringify(options)}`;

    // Check cache first
    if (this.config.caching.enabled && this.translationCache.has(cacheKey)) {
      this.metrics.cacheHits++;
      return this.translationCache.get(cacheKey);
    }

    this.metrics.cacheMisses++;

    // Get translation with fallback chain
    let translation = this.getTranslationWithFallback(key, locale, context);

    // Handle pluralization
    if (count !== undefined && translation) {
      translation = this.handlePluralization(translation, count, locale);
    }

    // Handle interpolations
    if (translation && Object.keys(interpolations).length > 0) {
      translation = this.interpolateTranslation(translation, interpolations);
    }

    // Cache the result
    if (this.config.caching.enabled && translation) {
      this.cacheTranslation(cacheKey, translation);
    }

    return translation || key; // Return key as fallback
  }

  getTranslationWithFallback(key, locale, context) {
    // Try exact locale first
    let translation = this.getTranslation(key, locale, context);
    if (translation) return translation;

    // Try fallback chain
    const fallbacks = this.config.fallbackChain[locale] || [
      this.config.defaultLocale,
    ];
    for (const fallbackLocale of fallbacks) {
      translation = this.getTranslation(key, fallbackLocale, context);
      if (translation) {
        this.metrics.fallbackUsage++;
        return translation;
      }
    }

    // Log missing translation
    this.metrics.missingTranslations++;
    this.emit('missingTranslation', { key, locale, context });

    return null;
  }

  getTranslation(key, locale, context) {
    const localeTranslations = this.translations.get(locale);
    if (!localeTranslations) return null;

    // Try contextual translation first
    if (context) {
      const contextualKey = `${key}.${context}`;
      const contextualTranslation = localeTranslations.get(contextualKey);
      if (contextualTranslation) return contextualTranslation;
    }

    // Try regular translation
    return localeTranslations.get(key);
  }

  handlePluralization(translation, count, locale) {
    if (typeof translation !== 'object') return translation;

    const pluralRule = this.pluralizationRules.get(locale);
    if (!pluralRule) return translation.other || translation;

    const pluralForm = pluralRule(count);
    return translation[pluralForm] || translation.other || translation;
  }

  interpolateTranslation(translation, interpolations) {
    return translation.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return interpolations[key] !== undefined ? interpolations[key] : match;
    });
  }

  formatNumber(number, locale = this.config.defaultLocale, options = {}) {
    const formats = this.culturalRules.get('numberFormats');
    const format =
      formats?.get(locale) || formats?.get(this.config.defaultLocale);

    if (!format) return number.toString();

    const { style = 'decimal', currency } = options;

    try {
      const formatter = new Intl.NumberFormat(locale, {
        style,
        currency: currency || format.currency,
        ...options,
      });
      return formatter.format(number);
    } catch (error) {
      this.logger.warn(`Number formatting failed for locale ${locale}:`, error);
      return number.toString();
    }
  }

  formatDate(date, locale = this.config.defaultLocale, options = {}) {
    const formats = this.culturalRules.get('dateFormats');
    const format =
      formats?.get(locale) || formats?.get(this.config.defaultLocale);

    if (!format) return date.toISOString();

    try {
      const formatter = new Intl.DateTimeFormat(locale, options);
      return formatter.format(date);
    } catch (error) {
      this.logger.warn(`Date formatting failed for locale ${locale}:`, error);
      return date.toISOString();
    }
  }

  isRTL(locale) {
    const rtlLanguages = this.culturalRules.get('rtlLanguages');
    return rtlLanguages?.has(locale) || false;
  }

  getCulturalColors(locale) {
    const colorMeanings = this.culturalRules.get('colorMeanings');
    return (
      colorMeanings?.get(locale) ||
      colorMeanings?.get(this.config.defaultLocale)
    );
  }

  setUserPreference(userId, preferences) {
    this.userPreferences.set(userId, {
      locale: preferences.locale,
      dateFormat: preferences.dateFormat,
      numberFormat: preferences.numberFormat,
      timezone: preferences.timezone,
      updatedAt: Date.now(),
    });

    this.emit('userPreferenceUpdated', { userId, preferences });
  }

  addTranslation(locale, key, translation, context) {
    if (!this.translations.has(locale)) {
      this.translations.set(locale, new Map());
    }

    const localeTranslations = this.translations.get(locale);
    const fullKey = context ? `${key}.${context}` : key;
    localeTranslations.set(fullKey, translation);

    // Clear related cache entries
    this.clearCacheForKey(locale, key);

    this.emit('translationAdded', { locale, key: fullKey, translation });
  }

  cacheTranslation(cacheKey, translation) {
    if (this.translationCache.size >= this.config.caching.maxSize) {
      // Remove oldest entries
      const oldestKey = this.translationCache.keys().next().value;
      this.translationCache.delete(oldestKey);
    }

    this.translationCache.set(cacheKey, {
      translation,
      timestamp: Date.now(),
    });
  }

  cleanupTranslationCache() {
    const now = Date.now();
    const ttl = this.config.caching.ttl;

    for (const [key, value] of this.translationCache) {
      if (now - value.timestamp > ttl) {
        this.translationCache.delete(key);
      }
    }

    this.logger.debug(
      `Translation cache cleaned up, size: ${this.translationCache.size}`
    );
  }

  clearCacheForKey(locale, key) {
    const keysToDelete = [];
    for (const cacheKey of this.translationCache.keys()) {
      if (cacheKey.startsWith(`${locale}:${key}`)) {
        keysToDelete.push(cacheKey);
      }
    }
    keysToDelete.forEach(key => this.translationCache.delete(key));
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.translationCache.size,
      translationsLoaded: Array.from(this.translations.entries()).reduce(
        (total, [_, localeMap]) => total + localeMap.size,
        0
      ),
      supportedLocales: this.config.supportedLocales.length,
      userPreferences: this.userPreferences.size,
      timestamp: Date.now(),
    };
  }

  async shutdown() {
    this.logger.info('Shutting down I18n Manager...');

    // Clear all caches and data
    this.translations.clear();
    this.translationCache.clear();
    this.contextualTranslations.clear();
    this.userPreferences.clear();
    this.contentAdaptations.clear();

    this.removeAllListeners();
    this.logger.info('I18n Manager shutdown complete');
  }
}

module.exports = { I18nManager };
