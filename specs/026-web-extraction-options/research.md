# Research: 026
- D1 `config` en query para el cuerpo .zip (el cliente ya envía el .zip crudo con `?language=`); en el cuerpo para `localPath`. Límite 8 KB evita abuso.
- D2 Validación delegada al motor (008): el web solo exige objeto JSON; el error del motor se conserva (mismo patrón que `reinfer`).
- D3 Tres opciones en la UI (las que cambian el resultado para el perfil legacy); el resto queda para la CLI/MCP.
