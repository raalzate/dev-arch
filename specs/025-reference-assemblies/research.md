# Research: 025
- D1 Ruta configurada en vez de PackageReference en el analizador: respeta el inventario de dependencias de 005 y deja al usuario elegir la versión del framework (v4.8 por defecto del paquete; otras carpetas `v4.x` valen igual).
- D2 Reemplazo (no mezcla) de los ensamblados del runtime: mezclar `mscorlib` 4.8 con `System.Runtime` 8 produce tipos duplicados.
- D3 Runner Windows `workflow_dispatch`: sin coste hasta que se ejecute; §7.3 decide si pasa a automático.
