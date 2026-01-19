// =========================================================
// SISTEMA DE CARGA - POKEAPI
// =========================================================

class PokemonLoadingSystem {
    constructor() {
        this.startTime = Date.now();
        this.progress = 0;
        this.messageIndex = 0;
        this.intervalId = null;

        // Elementos DOM
        this.progressBar = document.getElementById('progressBar');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressStatus = document.getElementById('progressStatus');
        this.loadingMessage = document.getElementById('loadingMessage');
        this.loadingText = document.getElementById('loadingText');

        // Elementos de datos
        this.pokemonCount = document.getElementById('pokemonCount');
        this.trainerCount = document.getElementById('trainerCount');
        this.gymCount = document.getElementById('gymCount');
        this.loadSpeed = document.getElementById('loadSpeed');

        // Mensajes de carga
        this.messages = [
            "Inicializando módulo Pokédex...",
            "Conectando con servidor global...",
            "Cargando datos de Pokémon...",
            "Inicializando radar de Pokémon...",
            "¡Listo para la aventura!"
        ];

        // Obtener parámetros de la URL
        this.urlParams = new URLSearchParams(window.location.search);
        this.customMessage = this.urlParams.get('message');
        this.redirectUrl = this.urlParams.get('redirectTo') || '/pokedex';
        this.duration = parseInt(this.urlParams.get('duration')) || 1500; // ms

        // Inicializar
        this.init();
    }

    init() {
        // Establecer mensaje personalizado si existe
        if (this.customMessage) {
            this.loadingText.textContent = this.customMessage;
        }

        // Iniciar simulación de carga
        this.startLoadingSimulation();

        // Iniciar efectos de fondo
        this.startBackgroundEffects();

        // Preparar redirección
        this.prepareRedirection();
    }

    startLoadingSimulation() {
        // Simular progreso de carga
        this.intervalId = setInterval(() => {
            this.updateLoading();
        }, 100 + Math.random() * 200);
    }

    updateLoading() {
        if (this.progress < 100) {
            // Incrementar progreso
            this.progress += Math.random() * 3 + 1;
            if (this.progress > 100)
                this.progress = 100;

            // Actualizar barra
            this.progressBar.style.width = this.progress + '%';
            this.progressPercent.textContent = Math.floor(this.progress) + '%';

            // Actualizar mensaje cada 10%
            if (this.progress >= (this.messageIndex + 1) * 10) {
                this.messageIndex = Math.min(Math.floor(this.progress / 10), this.messages.length - 1);
                if (!this.customMessage) {
                    this.loadingMessage.textContent = this.messages[this.messageIndex];
                }
                this.progressStatus.textContent = this.getStatusText(this.progress);
            }

            // Actualizar datos dinámicos
            this.updateDynamicData(this.progress);

        } else {
            // Carga completada
            this.loadingComplete();
        }
    }

    getStatusText(progress) {
        if (progress < 25)
            return "Inicializando...";
        if (progress < 50)
            return "Cargando datos...";
        if (progress < 75)
            return "Sincronizando...";
        if (progress < 95)
            return "Finalizando...";
        return "Completando...";
    }

    updateDynamicData(progress) {
        // Pokémon cargados (0 a 898)
        const pokemonLoaded = Math.min(898, Math.floor(progress * 8.98));
        this.pokemonCount.textContent = pokemonLoaded.toString().padStart(3, '0');

        // Gimnasios activos (0 a 250)
        const gymsActive = Math.min(250, Math.floor(progress * 2.5));
        this.gymCount.textContent = gymsActive.toString().padStart(3, '0');

        // Velocidad de carga (simulada)
        const currentTime = Date.now();
        const elapsed = (currentTime - this.startTime) / 1000;
        this.loadSpeed.textContent = elapsed.toFixed(1) + 's';
    }

    loadingComplete() {
        clearInterval(this.intervalId);

        this.loadingMessage.textContent = "¡Pokédex lista!";
        this.progressStatus.textContent = "Completado";

        // Calcular velocidad de carga final
        const endTime = Date.now();
        const loadTime = ((endTime - this.startTime) / 1000).toFixed(1);
        this.loadSpeed.textContent = loadTime + 's';

        // Asegurar que la barra esté al 100%
        this.progressBar.style.width = '100%';
        this.progressPercent.textContent = '100%';
    }

    startBackgroundEffects() {
        // Crear efectos flotantes periódicamente
        setInterval(() => {
            this.createFloatingEffect();
        }, 3000);

        // Crear algunos efectos iniciales
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                this.createFloatingEffect();
            }, i * 500);
        }
    }

    createFloatingEffect() {
        const container = document.querySelector('.background-effects');
        const pokeball = document.createElement('div');
        pokeball.className = 'floating-pokeball';

        // Posición aleatoria
        pokeball.style.left = Math.random() * 100 + '%';
        pokeball.style.top = Math.random() * 100 + '%';

        // Tamaño aleatorio
        const size = 20 + Math.random() * 40;
        pokeball.style.width = size + 'px';
        pokeball.style.height = size + 'px';

        // Opacidad aleatoria
        pokeball.style.opacity = 0.1 + Math.random() * 0.3;

        // Animación personalizada
        const duration = 15 + Math.random() * 15;
        pokeball.style.animationDuration = duration + 's';
        pokeball.style.animationDelay = Math.random() * 5 + 's';

        container.appendChild(pokeball);

        // Remover después de la animación
        setTimeout(() => {
            if (pokeball.parentNode) {
                pokeball.remove();
            }
        }, duration * 1000);
    }

    prepareRedirection() {
        // Configurar redirección automática
        setTimeout(() => {
            this.redirectToTarget();
        }, this.duration);
    }

    redirectToTarget() {
        // Construir URL final con parámetros
        let finalUrl = this.redirectUrl;

        // Pasar todos los parámetros excepto los específicos de loading
        const excludeParams = ['redirectTo', 'message', 'duration'];
        const params = new URLSearchParams();

        this.urlParams.forEach((value, key) => {
            if (!excludeParams.includes(key) && value) {
                params.append(key, value);
            }
        });

        const queryString = params.toString();
        if (queryString) {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryString;
        }

        // Redirigir
        window.location.href = finalUrl;
    }
}

// =========================================================
// INICIAR SISTEMA CUANDO EL DOM ESTÉ LISTO
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    const loadingSystem = new PokemonLoadingSystem();

    // También exportar para uso global si es necesario
    window.PokemonLoadingSystem = PokemonLoadingSystem;
});

