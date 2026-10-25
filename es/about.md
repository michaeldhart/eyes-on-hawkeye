---
title: Acerca de
lang: es
description: "Eyes on Hawkeye es un proyecto voluntario que publica los registros públicos sobre el centro de datos propuesto en Belvidere, con resúmenes en lenguaje sencillo escritos por IA."
---
Eyes on Hawkeye es un proyecto voluntario de vecinos que quieren entender lo que su gobierno local está haciendo con respecto a un centro de datos propuesto, y que piensan que todos los demás también deberían poder entenderlo.

## Quién está detrás

Eyes on Hawkeye fue creado, y es mantenido, por {% include author.html %}. Es activista y organizador local, e ingeniero de software de profesión. En la era de la IA, usa la IA para devolverle poder a la gente: para leer, ordenar y buscar en los registros públicos, de modo que los residentes no necesiten un equipo de abogados ni una solicitud de registros para saber lo que hace su gobierno. Reúne los documentos y administra el sitio. Los resúmenes los escribe una IA, como se explica en Cómo trabajamos.

## Qué encontrará aquí

- **Documentos.** Los registros públicos que la ciudad ha publicado, guardados aquí tal como la ciudad los entregó. Cuando conocemos la dirección web original, la enlazamos.
- **Una cronología.** Los documentos y los hechos que contienen, en orden, para que pueda ver qué pasó y cuándo.
- **Búsqueda.** Búsqueda de texto completo en todo lo que hemos publicado.

## Cómo trabajamos {#how-we-work}

1. Obtenemos los documentos de las publicaciones públicas de la propia ciudad o de solicitudes de registros públicos.
2. Guardamos una copia sin modificar de cada archivo y enlazamos a su origen.
3. Muchos de los archivos son escaneos. Les aplicamos reconocimiento de texto para que se puedan buscar. Ese texto lo produce una máquina y puede contener errores; el PDF es el registro.
4. **Los resúmenes los escribe una IA.** Claude, un asistente de IA creado por Anthropic, lee el texto de cada documento y escribe el breve resumen y las entradas de la cronología que le ayudan a orientarse. {% include author.html %} no los escribe a mano. Las cifras y fechas clave se comprueban con las páginas escaneadas, pero una IA todavía puede equivocarse. Los documentos hablan por sí mismos, así que lea el original cuando importe.
5. Si nos equivocamos en algo, incluso en un resumen, [avísenos]({{ "/contact/" | loc | relative_url }}) y lo corregiremos y dejaremos constancia de la corrección.

## La versión en español

Este sitio también está disponible en inglés. Aparece en español automáticamente cuando el idioma de su navegador es el español, y el enlace “English” o “Español” al pie de cada página permite cambiar de uno a otro.

El español está traducido del inglés por Claude, la misma IA que escribe los resúmenes. No traducimos los documentos mismos: los PDF y su texto completo siguen en inglés, porque son el registro. Las citas textuales también se quedan en inglés, tal como están en los registros, seguidas de una traducción al español entre paréntesis. Voluntarios que hablan español están revisando las traducciones, y cada página en español indica si una persona ya la ha revisado. Si encuentra un error en cualquiera de los dos idiomas, [avísenos]({{ "/contact/" | loc | relative_url }}).

## Lo que no somos

No somos la ciudad y no hablamos en su nombre. No tenemos información privilegiada. Todo lo que hay aquí es algo que cualquier residente podría solicitar, y queremos ahorrarle la molestia.

## Lo que este sitio registra sobre usted

{% if site.goatcounter_code -%}
Este sitio cuenta las visitas a sus páginas con [GoatCounter](https://www.goatcounter.com), un servicio de análisis de código abierto. No usa cookies y no recopila datos personales, por eso no le pidieron cerrar un aviso para leer esto. Registra la página, de dónde llegó, su país, su navegador y sistema operativo, y el tamaño de su pantalla. Todo eso se cuenta de forma agregada, nunca se vincula a una persona, nunca se vende y nunca se comparte.

No tiene que creernos por fe. Las cifras son [públicas](https://{{ site.goatcounter_code }}.goatcounter.com), y usted puede ver lo mismo que vemos nosotros. Un sitio que le pide que exija cuentas al gobierno no debería ocultar cuánta gente lo lee.
{%- else -%}
No se cuenta nada. Este sitio no usa análisis, no instala cookies y no tiene ningún registro de que usted estuvo aquí.
{%- endif %}

Si elige un idioma con el enlace al pie de una página, su navegador recuerda esa elección en su dispositivo, en el almacenamiento local y no en una cookie. Se queda en su dispositivo y nunca se nos envía.
