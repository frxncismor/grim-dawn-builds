# Fuentes autoalojadas

T-017 implementa las familias fijadas en spec §5 y plan §7. Solo se sirven WOFF2
locales desde `/fonts/`; la app no consulta Google Fonts ni Fontsource en runtime.
No se añadió ninguna dependencia de fuentes al manifiesto npm de la aplicación.

Los archivos proceden de paquetes oficiales Fontsource 5.3.0, descargados y
verificados por SHA-512 antes de extraerlos. Se conservaron sus binarios y textos
de licencia OFL-1.1 con copyright; las declaraciones CSS seleccionan los subsets
y apuntan al archivo local. El CSS usa los nombres Oswald/Karla, sin el sufijo
de distribución Variable; los binarios no se modificaron.

| Paquete | Tarball verificado | Integridad SHA-512 (base64) |
| --- | --- | --- |
| @fontsource-variable/oswald 5.3.0 | [oswald-5.3.0.tgz](https://registry.npmjs.org/@fontsource-variable/oswald/-/oswald-5.3.0.tgz) | sSZzcTeaQGNyZbTVlS4tNNHElK38UktFLqKd6NQDLFCBV27320rQC3kXSZVytYm1PPjKmPxqVaGwqj7LEKUWQw== |
| @fontsource-variable/karla 5.3.0 | [karla-5.3.0.tgz](https://registry.npmjs.org/@fontsource-variable/karla/-/karla-5.3.0.tgz) | CypH/IGhvpU0I4sue6YG+ZDyx5heglFJAiU2NClTkKOh+jsqjZ7AAgWKGG59+X1dGCN/9L4BLLacCXD7TBBETA== |
| @fontsource/space-mono 5.3.0 | [space-mono-5.3.0.tgz](https://registry.npmjs.org/@fontsource/space-mono/-/space-mono-5.3.0.tgz) | FrpBMOVWn3PRdRHlrZWC55X3kZG/2BTH7SM5ZyS/bky3iKya2BturI5lk+t0RoDQL2JyHzURsVq/EisCsxpI5A== |

| Archivo WOFF2 | Bytes | SHA-256 |
| --- | ---: | --- |
| karla-latin-ext-wght-normal.woff2 | 15232 | 14291dd5043b30e82448f15e1e7556a740c9e89378efc91d22c6324ae229f04c |
| karla-latin-wght-normal.woff2 | 32116 | cd614fed3fa0bf1b083d1a127a593081e2a1aa732ad61481eb12baee212c933d |
| oswald-latin-ext-wght-normal.woff2 | 23952 | 7989ccc7770f5aeffa67e088bcd3b294d42fae2f8b0eca3c3c51b953d1f735cc |
| oswald-latin-wght-normal.woff2 | 28488 | bd73278ee0c50041b91b4c03d1229e35b501637f46b6409e7da2d3a758446ea5 |
| space-mono-latin-400-normal.woff2 | 16520 | fb4a81a2d0a893e5c38c394a7e716a1cef0b24610a0af49c96f6d529bd66bf2b |

Total: 116308 bytes, cinco archivos y tres familias. Oswald y Karla contienen
latin y latin-ext con pesos variables; Space Mono carga regular latin para los
datos/mediciones en español y ASCII. Las reglas unicode-range conservan los
rangos de los paquetes. Karla latin y Oswald latin se precargan con crossorigin;
font-display swap mantiene texto visible durante la carga.

Licencias redistribuidas: [Oswald](../public/fonts/LICENSE-oswald.txt),
[Karla](../public/fonts/LICENSE-karla.txt) y
[Space Mono](../public/fonts/LICENSE-space-mono.txt). El catálogo de licencias de
arte del juego es independiente y sigue sin aprobar activos oficiales.

El script `pnpm check:contrast` usa los colores efectivos de tokens.css y el
umbral 4.5:1 sin redondear, conforme a
[WCAG 2.2, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
La verificación del esquema tipográfico no acredita por sí sola CLS/Lighthouse,
que se miden sobre las rutas terminadas en T-042.
