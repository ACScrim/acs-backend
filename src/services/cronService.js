const cron = require("node-cron");
const winston = require("winston");

// Augmenter la limite des listeners pour éviter le warning
process.setMaxListeners(20);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

// Configuration globale des crons
const cronOptions = {
  timezone: "Europe/Paris",
  runOnInit: false // Ne pas exécuter au démarrage
};

// Map pour garder une trace des tâches actives
const activeTasks = new Map();

const safeCronJob = (fn, jobName) => {
  return async () => {
    try {
      logger.info(`🚀 Démarrage: ${jobName}`);
      const startTime = Date.now();
      
      await fn();
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Terminé: ${jobName} (${duration}ms)`);
    } catch (error) {
      logger.error(`❌ Erreur dans ${jobName}:`, error);
    }
  };
};

const startJobs = (jobs) => {
  jobs.forEach(({ schedule, task, name }) => {
    // Vérifier si la tâche existe déjà
    if (activeTasks.has(name)) {
      logger.warn(`⚠️ Tâche ${name} déjà active, arrêt de l'ancienne`);
      activeTasks.get(name).stop();
    }

    // Créer et démarrer la nouvelle tâche
    const cronTask = cron.schedule(schedule, task, {
      ...cronOptions,
      name: name,
      scheduled: true
    });

    // Stocker la référence
    activeTasks.set(name, cronTask);
    
    logger.info(`📅 Cron programmé: ${name} (${schedule})`);
  });
};

const stopAllJobs = () => {
  logger.info("🛑 Arrêt de toutes les tâches cron");
  
  activeTasks.forEach((task, name) => {
    task.stop();
    logger.info(`⏹️ Tâche arrêtée: ${name}`);
  });
  
  activeTasks.clear();
};

const getActiveJobs = () => {
  return Array.from(activeTasks.keys());
};

// Nettoyage à la fermeture du processus
process.on('SIGINT', () => {
  logger.info("🔄 Signal SIGINT reçu, arrêt des tâches cron");
  stopAllJobs();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info("🔄 Signal SIGTERM reçu, arrêt des tâches cron");
  stopAllJobs();
  process.exit(0);
});

module.exports = {
  safeCronJob,
  startJobs,
  stopAllJobs,
  getActiveJobs,
  cronOptions
};