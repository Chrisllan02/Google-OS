import React from 'react';

const loaderStyles = `
/* --- CONFIGURAÇÕES GERAIS --- */
.google-loader-container {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #050505;
    font-family: 'Google Sans', 'Poppins', sans-serif;
    overflow: hidden;
    gap: 0px;
    width: 100%;
    height: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 9999;
}

.visual-container {
    position: relative;
    width: 260px;
    height: 90px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 5px; 
}

/* --- WRAPPER DAS BOLINHAS --- */
.balls-wrapper {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
}

/* CONTAINER DE POSIÇÃO (Eixo X) */
.ball-pos {
    margin: 0 12px;
    width: 20px;
    height: 20px;
    animation: moveX 8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}

/* BOLINHA VISUAL (Eixo Y + Escala) */
.ball {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    
    backdrop-filter: blur(0px);
    background-color: var(--bg-color);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 0 12px var(--glow-color);
    
    animation: 
        bounceY 1.2s ease-in-out infinite, 
        scaleBalls 8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}

/* --- CORES E DISTÂNCIAS --- */
.pos-blue   { --offset: 66px; } 
.pos-red    { --offset: 22px; }
.pos-yellow { --offset: -22px; }
.pos-green  { --offset: -66px; }

.blue   { --glow-color: #4285f5; --bg-color: rgba(66, 133, 245, 0.95); }
.red    { --glow-color: #ea4436; --bg-color: rgba(234, 68, 54, 0.95); animation-delay: 0.1s; }
.yellow { --glow-color: #fbbd06; --bg-color: rgba(251, 189, 6, 0.95); animation-delay: 0.2s; }
.green  { --glow-color: #34a952; --bg-color: rgba(52, 169, 82, 0.95); animation-delay: 0.3s; }

/* --- KEYFRAMES FLUIDOS --- */

@keyframes moveX {
    0% { transform: translateX(0); }
    35% { transform: translateX(0); }
    45% { transform: translateX(var(--offset)); } 
    85% { transform: translateX(var(--offset)); } 
    95% { transform: translateX(0); } 
    100% { transform: translateX(0); }
}

@keyframes scaleBalls {
    0%, 38% { transform: scale(1); opacity: 1; }
    43% { transform: scale(0.2); opacity: 0; } 
    87% { transform: scale(0.2); opacity: 0; } 
    92% { transform: scale(1); opacity: 1; } 
    100% { transform: scale(1); opacity: 1; }
}

@keyframes bounceY {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
}

/* --- ÍCONE G --- */
.icons-wrapper {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
}

.icon-box {
    width: 80px;
    height: 80px;
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
}

.google-icon {
    animation: googleTransition 8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}

.g-mask {
    width: 100%;
    height: 100%;
    --svg-google: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M12.222 5.977a5.4 5.4 0 0 1 3.823 1.496l2.868-2.868A9.6 9.6 0 0 0 12.222 2a10 10 0 0 0-8.937 5.51l3.341 2.59a5.96 5.96 0 0 1 5.596-4.123' opacity='1'/%3E%3Cpath fill='%23000' d='M3.285 7.51a10.01 10.01 0 0 0 0 8.98l3.341-2.59a5.9 5.9 0 0 1 0-3.8z'/%3E%3Cpath fill='%23000' d='M15.608 17.068A6.033 6.033 0 0 1 6.626 13.9l-3.34 2.59A10 10 0 0 0 12.221 22a9.55 9.55 0 0 0 6.618-2.423z' opacity='1'/%3E%3Cpath fill='%23000' d='M21.64 10.182h-9.418v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018l-.01.006l.01-.006l3.232 2.51a9.75 9.75 0 0 0 2.982-7.35q0-1.032-.182-2.046' opacity='1'/%3E%3C/svg%3E");
    -webkit-mask-image: var(--svg-google);
    mask-image: var(--svg-google);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-position: center;
    mask-position: center;

    background: conic-gradient(from 45deg, #4285f5 0%, #ea4436 25%, #fbbd06 50%, #34a952 75%, #4285f5 100%);
    
    /* BRILHO AUMENTADO: 3 Camadas de Drop-Shadow */
    /* 1. Brilho branco intenso no centro (núcleo) */
    /* 2. Brilho azulado médio */
    /* 3. Aura ampla e difusa */
    filter: 
        drop-shadow(0 0 5px rgba(255, 255, 255, 1)) 
        drop-shadow(0 0 20px rgba(66, 133, 245, 0.8)) 
        drop-shadow(0 0 40px rgba(66, 133, 245, 0.4));
}

/* Transição do G */
@keyframes googleTransition {
    0%, 40% { 
        opacity: 0; 
        transform: scale(0) rotate(-180deg); 
    }
    45% { 
        opacity: 1; 
        transform: scale(1); 
        filter: blur(0px);
    }
    85% { 
        opacity: 1; 
        transform: scale(1) rotate(0deg); 
    }
    90% { 
        opacity: 0; 
        transform: scale(0.2) rotate(180deg); 
        filter: blur(0px);
    }
    100% { 
        opacity: 0; 
        transform: scale(0); 
    }
}


/* --- TEXTO DE CARREGAMENTO --- */
.card {
    background-color: transparent; 
    padding: 0; 
    border: none;
    width: 100%;
    display: flex;
    justify-content: center;
}

.loader {
    color: rgb(150, 150, 150);
    font-family: "Poppins", sans-serif;
    font-weight: 500;
    font-size: 18px; 
    -webkit-box-sizing: content-box;
    box-sizing: content-box;
    height: 30px; 
    display: flex;
    align-items: center; 
    justify-content: center;
    width: 300px;
}

.loader p {
    margin: 0;
    padding-right: 12px;
    line-height: 30px; 
    text-align: right; 
    flex: 1; 
}

.words {
    overflow: hidden;
    height: 100%;
    display: flex;
    flex-direction: column;
    text-align: left;
    flex: 1;
    position: relative; /* Ensure ::after is positioned relative to this */
}

.words::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
        #050505 0%,
        transparent 25%,
        transparent 75%,
        #050505 100%
    );
    z-index: 20;
}

.word {
    display: block;
    height: 100%;
    padding-left: 0;
    color: #ffffff;
    animation: spin_4991 4s infinite;
    letter-spacing: 2px;
    line-height: 30px; 
    white-space: nowrap;
}

@keyframes spin_4991 {
    10% { transform: translateY(-102%); }
    25% { transform: translateY(-100%); }
    35% { transform: translateY(-202%); }
    50% { transform: translateY(-200%); }
    60% { transform: translateY(-302%); }
    75% { transform: translateY(-300%); }
    85% { transform: translateY(-402%); }
    100% { transform: translateY(-400%); }
}
`;

export default function GoogleLoader() {
  return (
    <>
        <style>{loaderStyles}</style>
        <div className="google-loader-container">
            <div className="visual-container">
                {/* Wrapper das Bolinhas */}
                <div className="balls-wrapper">
                    <div className="ball-pos pos-blue">
                        <div className="ball blue"></div>
                    </div>
                    <div className="ball-pos pos-red">
                        <div className="ball red"></div>
                    </div>
                    <div className="ball-pos pos-yellow">
                        <div className="ball yellow"></div>
                    </div>
                    <div className="ball-pos pos-green">
                        <div className="ball green"></div>
                    </div>
                </div>

                {/* Wrapper do Ícone G */}
                <div className="icons-wrapper">
                    <div className="icon-box google-icon">
                        <div className="neon-mask g-mask"></div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="loader">
                    <p>Carregando</p>
                    <div className="words">
                        <span className="word">E-mail</span>
                        <span className="word">Agenda</span>
                        <span className="word">Planilhas</span>
                        <span className="word">Documentos</span>
                        <span className="word">Drive</span>
                        <span className="word">Apresentações</span>
                        <span className="word">Meet</span>
                    </div>
                </div>
            </div>
        </div>
    </>
  );
}