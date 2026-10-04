# Construcción: diseño del tablero

Diseño implementado en `construction.html`. Todos los datos del ejemplo son ficticios; no proceden de las fotografías actuales. La pantalla está en el menú como **Construcción**, junto a Bitácora visual y Supervisión en sitio. El prototipo de diseño mostraba una semana; la implementación cubre 31 días, del 2 de septiembre al 2 de octubre de 2026.

## Qué se puede medir

**Personas visibles** es una medición de presencia en zonas cubiertas, no una lista de asistencia, empleados únicos, horas trabajadas ni productividad. Una persona oculta o fuera del encuadre no desaparece de la obra. No se sumarán conteos de fotogramas ni de cámaras que cubran la misma zona.

**Cruces de acceso** requieren una línea configurada y seguimiento de dirección. Entradas menos salidas permiten estimar ocupación solamente cuando se conocen la ocupación inicial y todos los accesos. Reingresos no equivalen a trabajadores diferentes. Un balance negativo debe señalar una inconsistencia, no corregirse silenciosamente a cero.

**Visitas de camiones** enlazan una entrada con una salida. Para enlazarlas después de una permanencia larga se necesita matrícula, referencia operativa o revisión; tipo y color no bastan. Las visitas pendientes, salidas sin entrada asociada y permanencias entre dos fechas se conservarán explícitamente.

El material podrá tener origen en una remisión o confirmación del supervisor. La visión puede sugerir materiales visibles si existe un modelo entrenado, pero un detector genérico de objetos no identifica por sí solo arena, grava ni cantidades. El estado de salida será: aparentemente vacío, carga visible, carga parcial o no verificable. Una revolvedora cerrada o un camión con lona no permite certificar que esté vacío. Pesos, cantidades y descarga completa requieren otra fuente.

## Frecuencia recomendada

- Zonas de trabajo: ráfaga de 20–30 segundos cada **10 minutos**, con mediana de conteos válidos dentro de cada ráfaga. Es una propuesta para un piloto, ajustable según cámara, movimiento y recursos.
- Vista habitual: bloques de **30 minutos**, con promedio de las muestras válidas y cobertura de muestras recibidas/esperadas. Puede cambiarse a 10 o 60 minutos. El máximo del día se calcula sobre las muestras originales, sin redondearlo al promedio de la gráfica.
- Acceso: clips disparados por movimiento y analizados durante el cruce. No hace falta analizar toda la obra continuamente, pero las fotos aisladas cada media hora pueden perder una visita completa.
- Si solamente hay capturas periódicas, las horas se muestran como ventanas de observación y los conteos como mínimos observados; no se promete hora exacta de entrada o salida.

Ausencia de muestra significa **sin datos**, nunca cero. Las ráfagas con baja luz, oclusión o cámara movida se marcan como inválidas o de calidad reducida. El promedio indicará su cobertura para evitar comparar una hora completa con una sola muestra.

## Jornada ficticia del ejemplo

Obra situada en México, zona horaria configurable; demostración con America/Mexico_City. El horario se configura por obra y fecha, no se deriva de una supuesta hora universal de puesta de sol.

| Cuadrilla | Personas programadas | Turno | Pausa | Comida |
|---|---:|---|---|---|
| A | 18 | 07:30–16:30 | 10:00–10:15 | 13:15–14:00 |
| B | 10 | 09:30–18:30 | 12:00–12:15 | 14:00–14:45 |

Estos turnos escalonados permiten que la obra opere hasta las 18:30 sin presentar una jornada de doce horas para cada persona. Son supuestos del ejemplo, no una política laboral. Sábado tiene un turno reducido y domingo no tiene actividad programada del frente. La primera presencia ficticia aparece a las 07:10, el máximo visible es 24 y la última presencia a las 18:40. Las 28 personas programadas no se equiparan a 24 personas visibles.

Los descansos sombreados son **programados**. Una caída de personas visibles no confirma descanso ni abandono. La última presencia observada tampoco confirma cierre; debe mostrarse separada de la hora programada y de un eventual cierre confirmado por supervisor.

## Distribución de la pantalla

### Jornada

1. Cabecera con fecha, navegación anterior/siguiente, pestañas Jornada y Varios días, aviso persistente Datos ficticios y zona horaria.
2. Indicadores: primera presencia, máximo visible y hora, última presencia, camiones entraron/salieron y pendientes. Todos calculados del mismo conjunto de registros.
3. Gráfica principal de personas visibles: tiempo horizontal, promedio de personas vertical, bloques seleccionables de 10/30/60 minutos, franjas de descanso y comida programados. Los huecos no se unirán con una línea que invente continuidad. Selección de un bloque con rango, conteos, número de muestras y cobertura.
4. Permanencias de camiones: carriles por visita sobre el mismo horario; inicio y fin identificables. La tabla conserva material, llegada, salida, duración, carga al salir y fuente del dato. Visitas sin salida permanecen abiertas.
5. Cobertura: muestras válidas, faltantes y cámaras disponibles. Avisos concretos sobre pérdida de cobertura, visitas sin asociación o datos que necesitan revisión; no alarmas de baja productividad basadas únicamente en visibilidad.

### Varios días

Mapa de calor por fecha y hora con promedio visible, gris para sin datos y señal distinta para día sin actividad programada. Seleccionar un día abre su jornada. Indicadores comparables: máximo visible por día, primera/última presencia, visitas, permanencia mediana y estados de carga de las salidas. No se suman máximos para fabricar un total de trabajadores. Comparar jornadas del mismo tipo y con cobertura semejante; separar sábado, domingo y días con fallos de cámara.

La implementación incluye tendencias diarias de presencia y visitas junto al mapa de calor, manteniendo pendientes fuera de las duraciones completadas. También incluye materiales con permanencia mediana y distribución de carga al salir.

## Visitas ficticias del 3 de septiembre de 2026

| ID | Vehículo / operación | Material | Llegada | Salida | Minutos | Estado al salir |
|---|---|---|---|---|---:|---|
| T-001 | Volteo / entrega | Arena | 07:45 | 08:35 | 50 | Aparentemente vacío |
| T-002 | Plataforma / entrega | Varilla | 09:20 | 11:05 | 105 | Aparentemente vacío |
| T-003 | Revolvedora / entrega | Concreto | 11:40 | 12:25 | 45 | No verificable: tambor cerrado |
| T-004 | Volteo / entrega | Grava | 14:10 | 15:00 | 50 | Carga parcial |
| T-005 | Plataforma / entrega | Block | 15:20 | 16:35 | 75 | Carga parcial |
| T-006 | Volteo / retiro | Escombro | 16:50 | 17:45 | 55 | Carga visible |

Seis entradas y seis salidas; cinco entregas y un retiro. Permanencia mediana 52.5 minutos. Materiales, horarios y estados son simulados. En producción cada campo distinguirá sugerencia visual, registro operativo y confirmación humana.

## Estructura de información e implementación posterior

Separar el conjunto ficticio de las fotos y detecciones actuales. Usar el mismo contrato de datos que recibiría un sistema real:

- `site_schedule`: fecha, turnos, pausas, cierres programados y excepciones.
- `camera_zone`: cámara, acceso/zona, área útil, calibración y cobertura.
- `observation_sample`: instante, ventana de captura, conteo visible, calidad y origen.
- `gate_event`: instante o ventana estimada, objeto, dirección, referencia y calidad.
- `truck_visit`: entrada, salida opcional, método de asociación y estado de revisión.
- `material_record`: material, carga de entrada/salida y fuente por campo.
- `review_log`: correcciones, responsable, fecha y valor anterior.

Guardar instantes con zona/desplazamiento explícitos y distinguir evento exacto de intervalo estimado. El origen `demo` debe permanecer visible y no mezclarse con evidencia real. Los indicadores se derivan de registros, no de cifras independientes escritas en cada tarjeta.

Archivos: `construction.html`, `construction.css`, `construction.js` y `construction-data.js`, reutilizando la navegación existente. La simulación es determinista y consultable por fecha. Se conservan 75 muestras de diez minutos por día (06:30–18:50); las ventanas se extienden hasta las 19:00. El menú de las tres pantallas incorpora Construcción.

Para un piloto real: cámara fija y acceso completo, región que excluya calle y transeúntes, cámara de zona para presencia y ángulo de carga/descarga si se desea revisar camiones. Validar contra conteo manual en horas con luz, sombra, lluvia y oclusiones antes de fijar umbrales. Los overlays se dibujarán desde cajas detectadas reales sobre el fotograma correspondiente; no se dibujarán detecciones ficticias sobre las fotos existentes.

## Criterios de aceptación

- Menú y fecha funcionan; Jornada y Varios días comparten registros y zona horaria.
- Cambiar 10/30/60 minutos modifica agregación, no entradas/salidas ni máximo original.
- Faltantes no aparecen como cero; cierre observado no se confunde con cierre confirmado.
- Duraciones y balances coinciden con eventos; visitas pendientes o entre fechas se conservan.
- Material y carga tienen fuente; una revolvedora cerrada conserva no verificable.
- No hay suma de personas de fotogramas ni duplicación de zonas superpuestas.
- Datos ficticios identificados en pantalla y futuras exportaciones.
- Navegación accesible con teclado; gráficas y tablas legibles en móvil.

## Referencias de viabilidad

AXIS documenta conteo por líneas y áreas, así como limitaciones de iluminación, oclusión y colocación: https://help.axis.com/en-us/axis-object-analytics . Ultralytics documenta conteo con seguimiento y cruces de región: https://docs.ultralytics.com/guides/object-counting . La frecuencia propuesta y los turnos son decisiones de diseño para esta demostración, no garantías de esos proveedores.
