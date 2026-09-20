# Malla Tablero, gestión de la inspección

Variante C de tres maquetas navegables del proyecto **Malla**, trabajo final de grado de
Ingeniería en Informática, Universidad del CEMA.

**Ver la maqueta: https://luciofex.github.io/malla-tablero/**

Las otras dos variantes:

- [malla-gis](https://github.com/LucioFex/malla-gis), el visor de capas
- [malla-recorrida](https://github.com/LucioFex/malla-recorrida), la hoja de ruta del día

## Qué problema resuelve

Las otras dos variantes le hablan a quien opera. Esta le habla a quien decide el
presupuesto de inspección, y responde dos preguntas distintas: está funcionando, y por qué
este tramo y no aquel.

## La pregunta que esta variante viene a contestar

En la reunión del 8 de septiembre quedó abierta una pregunta sobre hasta dónde llevar la
capa de inteligencia artificial. La propuesta original era un gateway de modelos
intercambiables. La respuesta apuntó a algo más acotado.

Esta variante muestra **la versión acotada**, para que el director confirme o corrija: una
consulta en lenguaje natural que **no estima ni opina**. Solo repite números que el
pipeline determinístico ya produjo, y muestra de dónde sale cada uno.

Es una decisión de diseño, no una limitación técnica. La priorización de Malla es
estadística y auditable. Si la explicación de por qué un tramo está primero la genera un
modelo de lenguaje sin anclaje, el sistema pierde la propiedad que lo vuelve defendible
ante un regulador.

Por eso cada respuesta viene con sus citas, y una de las preguntas disponibles es **qué no
puede responder el sistema**.

## Qué hace esta variante

- Cuatro indicadores de estado: red bajo seguimiento, concentración del riesgo, hogares
  expuestos y deuda de inspección.
- Serie mensual real de reclamos por inconvenientes en el suministro, de 2018 a 2026, con
  lectura al pasar el cursor.
- Índice de estacionalidad calculado sobre la serie completa, con los meses por encima y
  por debajo del promedio anual.
- Ranking de los tramos que encabezan la cola, con los días que llevan sin inspección.
- Consulta anclada, con trazabilidad al dato.
- Selector entre Bahía Blanca y Tandil.

## Un valor atípico que se señala en vez de disimularse

La serie publicada tiene un pico en julio de 2025, con 8.181 reclamos contra un promedio
mensual cercano a 3.600. La maqueta lo marca y avisa que hay que verificarlo contra el
crudo de ENARGAS antes de que entre al modelo. Un dato raro que no se explica es un
problema; uno que se explica es una decisión metodológica.

## Qué dato es real y qué dato es de muestra

**Real**

| Dato | Fuente | Licencia |
|---|---|---|
| Reclamos resueltos 2018 a 2026 | ENARGAS, portal de transparencia | CC BY 4.0 |
| Índice de estacionalidad | calculado sobre esa serie | derivado |
| Traza de calles y receptores sensibles | OpenStreetMap, vía Overpass | ODbL 1.0 |

**De muestra, generado de forma determinista**

- Hogares aguas abajo de cada tramo.
- Material, diámetro y antigüedad del caño.
- Fecha de última inspección.

**Límite de la fuente, verificado**

Los reclamos de ENARGAS **no bajan de provincia**. Las columnas publicadas son año, mes,
prestadora, provincia, grupo, vía de ingreso, resolución y cantidad. No hay localidad, ni
partido, ni domicilio, ni coordenadas, ni fecha exacta, ni identificador de reclamo
individual. Las filas ya vienen agregadas con un conteo.

Es decir que los reclamos de Camuzzi Gas Pampeana no se pueden bajar a Bahía Blanca ni a
Tandil. Lo máximo que se obtiene es Buenos Aires, La Pampa y Río Negro. Por eso la
probabilidad por tramo es una tasa base por zona modulada por atributos del tramo, y no
una frecuencia observada.

## Cómo está hecho

Sin compilación y sin dependencias que haya que instalar. Los gráficos son SVG dibujado a
mano, sin librería de visualización.

```
index.html            estructura
estilo.css            sistema visual compartido por las tres variantes
tablero.css           lo propio de esta variante
app.js                indicadores, gráficos y consulta anclada
datos/malla-datos.js  la capa de tramos y la serie de reclamos
```

Para verlo en local alcanza con servir la carpeta:

```
python -m http.server 8777
```

## Créditos de datos

- Reclamos resueltos por distribuidora: ENARGAS, portal de transparencia, CC BY 4.0.
- Callejero y receptores sensibles: © colaboradores de OpenStreetMap, ODbL 1.0.
- Radios censales previstos para la etapa siguiente: INDEC, censo 2022.

## Licencia

Código bajo licencia MIT. Los datos conservan la licencia de su fuente.
