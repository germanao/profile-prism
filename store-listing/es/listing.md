# Profile Prism

## Descripción breve

¿Qué tan auténtico es este perfil de LinkedIn? Puntúe evidencia visible de autenticidad en el dispositivo.

## Descripción completa

**¿Qué tan auténtico es este perfil?** El propósito de Profile Prism es puntuar la evidencia visible de autenticidad de un perfil de LinkedIn en un índice explicable de 0 a 100 junto al nombre.

La puntuación inicial automática resume cuán consistente y establecida parece la información mostrada en la página. Pase el cursor o enfoque con el teclado la insignia junto al nombre o el botón de puntuación inferior izquierdo para ver una explicación concisa. Pulse **Haz clic para verificar la autenticidad** cuando quiera que la extensión desplace el perfil actual, cargue sus secciones visibles e inspeccione los detalles nativos “Acerca de este miembro” antes de publicar el resultado final del perfil visible.

Limitaciones importantes:

- Es una puntuación heurística determinista, no una probabilidad.
- No es una verificación de identidad ni determina que una persona sea real, falsa, segura, confiable o esté involucrada en fraude.
- No detecta cuentas robadas o comprometidas.
- No lee mensajes, empleos, datos de contacto, otras pestañas, cookies ni API privadas de LinkedIn.
- El escaneo completo solo se ejecuta tras su acción, puede cancelarse, permanece en el perfil actual y no abre páginas contraídas “Ver todo” ni enlaces externos.
- No use la puntuación como única base para decisiones de contratación, empleo, denuncia, bloqueo o confianza.

Privacidad:

- La información del perfil se procesa temporalmente en el dispositivo.
- No se conserva contenido, URL, imagen, puntuación ni evidencia del perfil.
- Se descartan el texto sin procesar del cuadro de verificación, los nombres de organizaciones, las URL y los identificadores del perfil; solo la evidencia estructurada permanece en memoria para la ruta actual.
- No se transmite información del perfil ni actividad de navegación.
- No hay backend, telemetría, análisis, publicidad, modelo remoto ni consulta externa.

Interfaces compatibles: inglés, portugués y español.

## Justificación de permisos

- `storage`: recuerda la pausa de la evaluación automática, las preferencias de interfaz y la versión de las reglas. Nunca almacena información derivada de perfiles.
- `https://www.linkedin.com/*`: mantiene la extensión disponible durante la navegación interna de LinkedIn. Ignora las rutas que no son perfiles y solo lee información renderizada en páginas `/in/{profile_id}/` compatibles.
