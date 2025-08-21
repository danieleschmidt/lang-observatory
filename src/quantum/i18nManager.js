/**
 * Internationalization Manager for Quantum Task Planner
 * Provides multi-language support and localization
 */

const { Logger } = require('../utils/logger');

class QuantumI18nManager {
  constructor(config = {}) {
    this.logger = new Logger({ component: 'QuantumI18nManager' });
    this.config = config;

    // Supported locales
    this.supportedLocales = [
      'en',
      'es',
      'fr',
      'de',
      'ja',
      'zh',
      'pt',
      'it',
      'ru',
      'ko',
    ];

    // Default locale
    this.defaultLocale = config.defaultLocale || 'en';
    this.currentLocale = this.defaultLocale;

    // Translation storage
    this.translations = new Map();

    // Pluralization rules
    this.pluralRules = new Map();

    // Date/time formatting
    this.dateFormatters = new Map();
    this.timeFormatters = new Map();

    // Number formatting
    this.numberFormatters = new Map();

    // Currency formatting
    this.currencyFormatters = new Map();

    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.info('Initializing Quantum I18n Manager...');

      // Load translations for all supported locales
      await this.loadTranslations();

      // Initialize formatters
      this.initializeFormatters();

      // Set up pluralization rules
      this.setupPluralizationRules();

      this.initialized = true;
      this.logger.info(
        `I18n Manager initialized with ${this.supportedLocales.length} locales`
      );

      return this;
    } catch (error) {
      this.logger.error('Failed to initialize I18n Manager:', error);
      throw error;
    }
  }

  /**
   * Load translations for all supported locales
   */
  async loadTranslations() {
    const translations = {
      en: {
        // Common terms
        'common.task': 'Task',
        'common.tasks': 'Tasks',
        'common.planning': 'Planning',
        'common.execution': 'Execution',
        'common.completed': 'Completed',
        'common.failed': 'Failed',
        'common.pending': 'Pending',
        'common.priority': 'Priority',
        'common.duration': 'Duration',
        'common.resource': 'Resource',
        'common.resources': 'Resources',
        'common.error': 'Error',
        'common.warning': 'Warning',
        'common.success': 'Success',
        'common.high': 'High',
        'common.medium': 'Medium',
        'common.low': 'Low',

        // Quantum planning terms
        'quantum.coherence': 'Quantum Coherence',
        'quantum.superposition': 'Superposition',
        'quantum.entanglement': 'Entanglement',
        'quantum.collapse': 'State Collapse',
        'quantum.planning': 'Quantum Planning',
        'quantum.optimization': 'Quantum Optimization',

        // Status messages
        'status.initializing': 'Initializing quantum planner...',
        'status.planning': 'Planning tasks with quantum optimization...',
        'status.optimizing': 'Optimizing execution plan...',
        'status.executing': 'Executing task: {taskId}',
        'status.completed': 'Task {taskId} completed successfully',
        'status.failed': 'Task {taskId} failed: {error}',

        // Error messages
        'error.validation.failed': 'Validation failed: {errors}',
        'error.quantum.coherence_loss':
          'Quantum coherence loss detected - switching to classical planning',
        'error.resource.exhaustion':
          'Resource exhaustion detected - throttling operations',
        'error.permission.denied':
          'Insufficient permissions for operation: {operation}',
        'error.initialization.failed':
          'Failed to initialize component: {component}',

        // Metrics and reporting
        'metrics.efficiency': 'Planning Efficiency',
        'metrics.parallelism': 'Parallelism Factor',
        'metrics.total_duration': 'Total Duration',
        'metrics.task_count': 'Task Count',
        'metrics.success_rate': 'Success Rate',
        'metrics.avg_response_time': 'Average Response Time',
        'metrics.cache_hit_rate': 'Cache Hit Rate',

        // Time units
        'time.seconds': 'seconds',
        'time.minutes': 'minutes',
        'time.hours': 'hours',
        'time.days': 'days',
        'time.milliseconds': 'ms',

        // Validation messages
        'validation.required': 'Field {field} is required',
        'validation.invalid_type': 'Field {field} must be of type {type}',
        'validation.out_of_range':
          'Field {field} must be between {min} and {max}',
        'validation.circular_dependency':
          'Circular dependency detected: {cycle}',

        // Security messages
        'security.auth_failed': 'Authentication failed',
        'security.access_denied': 'Access denied',
        'security.rate_limit_exceeded':
          'Rate limit exceeded - please try again later',
        'security.token_expired': 'Authentication token expired',
      },

      es: {
        'common.task': 'Tarea',
        'common.tasks': 'Tareas',
        'common.planning': 'Planificación',
        'common.execution': 'Ejecución',
        'common.completed': 'Completado',
        'common.failed': 'Fallido',
        'common.pending': 'Pendiente',
        'common.priority': 'Prioridad',
        'common.duration': 'Duración',
        'common.resource': 'Recurso',
        'common.resources': 'Recursos',
        'common.error': 'Error',
        'common.warning': 'Advertencia',
        'common.success': 'Éxito',
        'common.high': 'Alto',
        'common.medium': 'Medio',
        'common.low': 'Bajo',

        'quantum.coherence': 'Coherencia Cuántica',
        'quantum.superposition': 'Superposición',
        'quantum.entanglement': 'Entrelazamiento',
        'quantum.collapse': 'Colapso de Estado',
        'quantum.planning': 'Planificación Cuántica',
        'quantum.optimization': 'Optimización Cuántica',

        'status.initializing': 'Inicializando planificador cuántico...',
        'status.planning': 'Planificando tareas con optimización cuántica...',
        'status.optimizing': 'Optimizando plan de ejecución...',
        'status.executing': 'Ejecutando tarea: {taskId}',
        'status.completed': 'Tarea {taskId} completada exitosamente',
        'status.failed': 'Tarea {taskId} falló: {error}',

        'error.validation.failed': 'Validación falló: {errors}',
        'error.quantum.coherence_loss':
          'Pérdida de coherencia cuántica detectada - cambiando a planificación clásica',
        'error.resource.exhaustion':
          'Agotamiento de recursos detectado - limitando operaciones',
        'error.permission.denied':
          'Permisos insuficientes para operación: {operation}',
        'error.initialization.failed':
          'Fallo al inicializar componente: {component}',

        'metrics.efficiency': 'Eficiencia de Planificación',
        'metrics.parallelism': 'Factor de Paralelismo',
        'metrics.total_duration': 'Duración Total',
        'metrics.task_count': 'Cantidad de Tareas',
        'metrics.success_rate': 'Tasa de Éxito',
        'metrics.avg_response_time': 'Tiempo de Respuesta Promedio',
        'metrics.cache_hit_rate': 'Tasa de Aciertos de Cache',

        'time.seconds': 'segundos',
        'time.minutes': 'minutos',
        'time.hours': 'horas',
        'time.days': 'días',
        'time.milliseconds': 'ms',

        'validation.required': 'El campo {field} es requerido',
        'validation.invalid_type': 'El campo {field} debe ser de tipo {type}',
        'validation.out_of_range':
          'El campo {field} debe estar entre {min} y {max}',
        'validation.circular_dependency':
          'Dependencia circular detectada: {cycle}',

        'security.auth_failed': 'Autenticación falló',
        'security.access_denied': 'Acceso denegado',
        'security.rate_limit_exceeded':
          'Límite de velocidad excedido - intente más tarde',
        'security.token_expired': 'Token de autenticación expirado',
      },

      fr: {
        'common.task': 'Tâche',
        'common.tasks': 'Tâches',
        'common.planning': 'Planification',
        'common.execution': 'Exécution',
        'common.completed': 'Terminé',
        'common.failed': 'Échoué',
        'common.pending': 'En attente',
        'common.priority': 'Priorité',
        'common.duration': 'Durée',
        'common.resource': 'Ressource',
        'common.resources': 'Ressources',
        'common.error': 'Erreur',
        'common.warning': 'Avertissement',
        'common.success': 'Succès',
        'common.high': 'Élevé',
        'common.medium': 'Moyen',
        'common.low': 'Faible',

        'quantum.coherence': 'Cohérence Quantique',
        'quantum.superposition': 'Superposition',
        'quantum.entanglement': 'Intrication',
        'quantum.collapse': "Effondrement d'État",
        'quantum.planning': 'Planification Quantique',
        'quantum.optimization': 'Optimisation Quantique',

        'status.initializing': 'Initialisation du planificateur quantique...',
        'status.planning':
          'Planification des tâches avec optimisation quantique...',
        'status.optimizing': "Optimisation du plan d'exécution...",
        'status.executing': 'Exécution de la tâche: {taskId}',
        'status.completed': 'Tâche {taskId} terminée avec succès',
        'status.failed': 'Tâche {taskId} échouée: {error}',

        'time.seconds': 'secondes',
        'time.minutes': 'minutes',
        'time.hours': 'heures',
        'time.days': 'jours',
        'time.milliseconds': 'ms',
      },

      de: {
        'common.task': 'Aufgabe',
        'common.tasks': 'Aufgaben',
        'common.planning': 'Planung',
        'common.execution': 'Ausführung',
        'common.completed': 'Abgeschlossen',
        'common.failed': 'Fehlgeschlagen',
        'common.pending': 'Ausstehend',
        'common.priority': 'Priorität',
        'common.duration': 'Dauer',
        'common.resource': 'Ressource',
        'common.resources': 'Ressourcen',
        'common.error': 'Fehler',
        'common.warning': 'Warnung',
        'common.success': 'Erfolg',
        'common.high': 'Hoch',
        'common.medium': 'Mittel',
        'common.low': 'Niedrig',

        'quantum.coherence': 'Quantenkohärenz',
        'quantum.superposition': 'Superposition',
        'quantum.entanglement': 'Verschränkung',
        'quantum.collapse': 'Zustandskollaps',
        'quantum.planning': 'Quantenplanung',
        'quantum.optimization': 'Quantenoptimierung',

        'status.initializing': 'Quantenplaner wird initialisiert...',
        'status.planning': 'Aufgaben werden mit Quantenoptimierung geplant...',
        'status.optimizing': 'Ausführungsplan wird optimiert...',
        'status.executing': 'Aufgabe wird ausgeführt: {taskId}',
        'status.completed': 'Aufgabe {taskId} erfolgreich abgeschlossen',
        'status.failed': 'Aufgabe {taskId} fehlgeschlagen: {error}',

        'time.seconds': 'Sekunden',
        'time.minutes': 'Minuten',
        'time.hours': 'Stunden',
        'time.days': 'Tage',
        'time.milliseconds': 'ms',
      },

      ja: {
        'common.task': 'タスク',
        'common.tasks': 'タスク',
        'common.planning': '計画',
        'common.execution': '実行',
        'common.completed': '完了',
        'common.failed': '失敗',
        'common.pending': '保留中',
        'common.priority': '優先度',
        'common.duration': '期間',
        'common.resource': 'リソース',
        'common.resources': 'リソース',
        'common.error': 'エラー',
        'common.warning': '警告',
        'common.success': '成功',
        'common.high': '高',
        'common.medium': '中',
        'common.low': '低',

        'quantum.coherence': '量子コヒーレンス',
        'quantum.superposition': '重ね合わせ',
        'quantum.entanglement': '量子もつれ',
        'quantum.collapse': '状態収束',
        'quantum.planning': '量子計画',
        'quantum.optimization': '量子最適化',

        'status.initializing': '量子プランナーを初期化中...',
        'status.planning': '量子最適化でタスクを計画中...',
        'status.optimizing': '実行プランを最適化中...',
        'status.executing': 'タスクを実行中: {taskId}',
        'status.completed': 'タスク {taskId} が正常に完了しました',
        'status.failed': 'タスク {taskId} が失敗しました: {error}',

        'time.seconds': '秒',
        'time.minutes': '分',
        'time.hours': '時間',
        'time.days': '日',
        'time.milliseconds': 'ミリ秒',
      },

      zh: {
        'common.task': '任务',
        'common.tasks': '任务',
        'common.planning': '规划',
        'common.execution': '执行',
        'common.completed': '已完成',
        'common.failed': '失败',
        'common.pending': '待处理',
        'common.priority': '优先级',
        'common.duration': '持续时间',
        'common.resource': '资源',
        'common.resources': '资源',
        'common.error': '错误',
        'common.warning': '警告',
        'common.success': '成功',
        'common.high': '高',
        'common.medium': '中',
        'common.low': '低',

        'quantum.coherence': '量子相干性',
        'quantum.superposition': '叠加态',
        'quantum.entanglement': '量子纠缠',
        'quantum.collapse': '态坍缩',
        'quantum.planning': '量子规划',
        'quantum.optimization': '量子优化',

        'status.initializing': '正在初始化量子规划器...',
        'status.planning': '正在使用量子优化规划任务...',
        'status.optimizing': '正在优化执行计划...',
        'status.executing': '正在执行任务: {taskId}',
        'status.completed': '任务 {taskId} 成功完成',
        'status.failed': '任务 {taskId} 失败: {error}',

        'time.seconds': '秒',
        'time.minutes': '分钟',
        'time.hours': '小时',
        'time.days': '天',
        'time.milliseconds': '毫秒',
      },
    };

    // Load translations into memory
    for (const [locale, localeTranslations] of Object.entries(translations)) {
      this.translations.set(locale, localeTranslations);
    }

    this.logger.info(
      `Loaded translations for ${Object.keys(translations).length} locales`
    );
  }

  /**
   * Initialize date, time, number, and currency formatters
   */
  initializeFormatters() {
    for (const locale of this.supportedLocales) {
      try {
        // Date formatters
        this.dateFormatters.set(
          locale,
          new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        );

        // Time formatters
        this.timeFormatters.set(
          locale,
          new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short',
          })
        );

        // Number formatters
        this.numberFormatters.set(
          locale,
          new Intl.NumberFormat(locale, {
            maximumFractionDigits: 2,
          })
        );

        // Currency formatters (USD as default, can be configured per region)
        this.currencyFormatters.set(
          locale,
          new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: this.getCurrencyForLocale(locale),
          })
        );
      } catch (error) {
        this.logger.warn(
          `Failed to initialize formatters for locale ${locale}:`,
          error
        );
        // Fallback to English formatters
        if (locale !== 'en') {
          this.dateFormatters.set(locale, this.dateFormatters.get('en'));
          this.timeFormatters.set(locale, this.timeFormatters.get('en'));
          this.numberFormatters.set(locale, this.numberFormatters.get('en'));
          this.currencyFormatters.set(
            locale,
            this.currencyFormatters.get('en')
          );
        }
      }
    }
  }

  /**
   * Set up pluralization rules for different languages
   */
  setupPluralizationRules() {
    const rules = {
      en: n => (n === 1 ? 'one' : 'other'),
      es: n => (n === 1 ? 'one' : 'other'),
      fr: n => (n <= 1 ? 'one' : 'other'),
      de: n => (n === 1 ? 'one' : 'other'),
      ja: () => 'other', // Japanese doesn't have plural forms
      zh: () => 'other', // Chinese doesn't have plural forms
      pt: n => (n === 1 ? 'one' : 'other'),
      it: n => (n === 1 ? 'one' : 'other'),
      ru: n => {
        if (n % 10 === 1 && n % 100 !== 11) return 'one';
        if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20))
          return 'few';
        return 'many';
      },
      ko: () => 'other', // Korean doesn't have plural forms
    };

    for (const [locale, rule] of Object.entries(rules)) {
      this.pluralRules.set(locale, rule);
    }
  }

  /**
   * Get currency code for locale
   */
  getCurrencyForLocale(locale) {
    const currencyMap = {
      en: 'USD',
      es: 'EUR',
      fr: 'EUR',
      de: 'EUR',
      ja: 'JPY',
      zh: 'CNY',
      pt: 'EUR',
      it: 'EUR',
      ru: 'RUB',
      ko: 'KRW',
    };

    return currencyMap[locale] || 'USD';
  }

  /**
   * Set current locale
   */
  setLocale(locale) {
    if (!this.supportedLocales.includes(locale)) {
      this.logger.warn(
        `Unsupported locale: ${locale}, falling back to ${this.defaultLocale}`
      );
      locale = this.defaultLocale;
    }

    this.currentLocale = locale;
    this.logger.info(`Locale changed to: ${locale}`);

    return this;
  }

  /**
   * Get current locale
   */
  getLocale() {
    return this.currentLocale;
  }

  /**
   * Translate a key with optional parameters
   */
  t(key, params = {}, locale = null) {
    const targetLocale = locale || this.currentLocale;
    const translations = this.translations.get(targetLocale);

    if (!translations) {
      this.logger.warn(`No translations found for locale: ${targetLocale}`);
      return key;
    }

    let translation = translations[key];

    // Fallback to default locale if translation not found
    if (!translation && targetLocale !== this.defaultLocale) {
      const defaultTranslations = this.translations.get(this.defaultLocale);
      translation = defaultTranslations ? defaultTranslations[key] : null;
    }

    // Fallback to key if still no translation
    if (!translation) {
      this.logger.debug(`Missing translation for key: ${key}`);
      return key;
    }

    // Replace parameters
    return this.interpolate(translation, params);
  }

  /**
   * Translate with pluralization
   */
  tn(key, count, params = {}, locale = null) {
    const targetLocale = locale || this.currentLocale;
    const pluralRule =
      this.pluralRules.get(targetLocale) ||
      this.pluralRules.get(this.defaultLocale);
    const pluralForm = pluralRule(count);

    const pluralKey = `${key}.${pluralForm}`;
    const translation = this.t(pluralKey, { ...params, count }, targetLocale);

    // If plural form not found, try the base key
    if (translation === pluralKey) {
      return this.t(key, { ...params, count }, targetLocale);
    }

    return translation;
  }

  /**
   * Interpolate parameters into translation string
   */
  interpolate(template, params) {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(params, key)
        ? params[key]
        : match;
    });
  }

  /**
   * Format date according to locale
   */
  formatDate(date, locale = null) {
    const targetLocale = locale || this.currentLocale;
    const formatter =
      this.dateFormatters.get(targetLocale) ||
      this.dateFormatters.get(this.defaultLocale);

    return formatter.format(new Date(date));
  }

  /**
   * Format time according to locale
   */
  formatTime(date, locale = null) {
    const targetLocale = locale || this.currentLocale;
    const formatter =
      this.timeFormatters.get(targetLocale) ||
      this.timeFormatters.get(this.defaultLocale);

    return formatter.format(new Date(date));
  }

  /**
   * Format number according to locale
   */
  formatNumber(number, locale = null) {
    const targetLocale = locale || this.currentLocale;
    const formatter =
      this.numberFormatters.get(targetLocale) ||
      this.numberFormatters.get(this.defaultLocale);

    return formatter.format(number);
  }

  /**
   * Format currency according to locale
   */
  formatCurrency(amount, locale = null) {
    const targetLocale = locale || this.currentLocale;
    const formatter =
      this.currencyFormatters.get(targetLocale) ||
      this.currencyFormatters.get(this.defaultLocale);

    return formatter.format(amount);
  }

  /**
   * Format duration in a human-readable way
   */
  formatDuration(milliseconds, locale = null) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} ${this.tn('time.days', days, {}, locale)}`;
    } else if (hours > 0) {
      return `${hours} ${this.tn('time.hours', hours, {}, locale)}`;
    } else if (minutes > 0) {
      return `${minutes} ${this.tn('time.minutes', minutes, {}, locale)}`;
    } else if (seconds > 0) {
      return `${seconds} ${this.tn('time.seconds', seconds, {}, locale)}`;
    } else {
      return `${milliseconds} ${this.t('time.milliseconds', {}, locale)}`;
    }
  }

  /**
   * Get all available locales
   */
  getAvailableLocales() {
    return [...this.supportedLocales];
  }

  /**
   * Check if locale is supported
   */
  isLocaleSupported(locale) {
    return this.supportedLocales.includes(locale);
  }

  /**
   * Detect locale from request headers
   */
  detectLocaleFromHeaders(acceptLanguageHeader) {
    if (!acceptLanguageHeader) {
      return this.defaultLocale;
    }

    // Parse Accept-Language header
    const languages = acceptLanguageHeader
      .split(',')
      .map(lang => {
        const [locale, q = '1'] = lang.trim().split(';q=');
        return { locale: locale.split('-')[0], quality: parseFloat(q) };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first supported locale
    for (const { locale } of languages) {
      if (this.isLocaleSupported(locale)) {
        return locale;
      }
    }

    return this.defaultLocale;
  }

  /**
   * Get localized error message
   */
  getErrorMessage(errorType, params = {}, locale = null) {
    const key = `error.${errorType}`;
    return this.t(key, params, locale);
  }

  /**
   * Get localized status message
   */
  getStatusMessage(statusType, params = {}, locale = null) {
    const key = `status.${statusType}`;
    return this.t(key, params, locale);
  }

  /**
   * Get localized validation message
   */
  getValidationMessage(validationType, params = {}, locale = null) {
    const key = `validation.${validationType}`;
    return this.t(key, params, locale);
  }

  /**
   * Get translation statistics
   */
  getTranslationStats() {
    const stats = {};

    for (const [locale, translations] of this.translations.entries()) {
      stats[locale] = {
        totalKeys: Object.keys(translations).length,
        locale: locale,
      };
    }

    return {
      supportedLocales: this.supportedLocales.length,
      currentLocale: this.currentLocale,
      defaultLocale: this.defaultLocale,
      localeStats: stats,
    };
  }

  /**
   * Export translations for a specific locale
   */
  exportTranslations(locale = null) {
    const targetLocale = locale || this.currentLocale;
    const translations = this.translations.get(targetLocale);

    if (!translations) {
      throw new Error(`No translations found for locale: ${targetLocale}`);
    }

    return JSON.stringify(translations, null, 2);
  }

  /**
   * Import translations for a locale
   */
  importTranslations(locale, translationsJson) {
    try {
      const translations = JSON.parse(translationsJson);
      this.translations.set(locale, translations);

      this.logger.info(
        `Imported ${Object.keys(translations).length} translations for locale: ${locale}`
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to import translations for locale ${locale}:`,
        error
      );
      return false;
    }
  }

  /**
   * Validate translations completeness
   */
  validateTranslations() {
    const baseLocale = this.defaultLocale;
    const baseTranslations = this.translations.get(baseLocale);

    if (!baseTranslations) {
      throw new Error(`Base locale ${baseLocale} translations not found`);
    }

    const baseKeys = new Set(Object.keys(baseTranslations));
    const validationResults = {};

    for (const [locale, translations] of this.translations.entries()) {
      if (locale === baseLocale) continue;

      const localeKeys = new Set(Object.keys(translations));
      const missingKeys = [...baseKeys].filter(key => !localeKeys.has(key));
      const extraKeys = [...localeKeys].filter(key => !baseKeys.has(key));

      validationResults[locale] = {
        missingKeys,
        extraKeys,
        completeness: (localeKeys.size - extraKeys.length) / baseKeys.size,
      };
    }

    return validationResults;
  }

  /**
   * Shutdown i18n manager
   */
  async shutdown() {
    this.logger.info('Shutting down I18n Manager...');

    this.translations.clear();
    this.pluralRules.clear();
    this.dateFormatters.clear();
    this.timeFormatters.clear();
    this.numberFormatters.clear();
    this.currencyFormatters.clear();

    this.initialized = false;
    this.logger.info('I18n Manager shutdown complete');
  }
}

module.exports = { QuantumI18nManager };
