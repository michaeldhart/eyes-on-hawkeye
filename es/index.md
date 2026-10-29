---
layout: default
title: Inicio
lang: es
---
{% unless page.es_reviewed %}<p class="note">{{ 'es_unreviewed_page' | t }}</p>{% endunless %}
<section class="hero">
  <p class="eyebrow">Proyecto comunitario de registros</p>
  <h1>Nuestro alcalde está considerando un centro de datos. Estamos leyendo cada página para que usted también pueda.</h1>
  <p class="lede">La ciudad ha publicado acuerdos, correos electrónicos y planes sobre un centro de datos propuesto. Están dispersos, escaneados y son difíciles de buscar. Los reunimos en un solo lugar, guardamos nuestra propia copia de cada uno y los ponemos en orden, para que los residentes puedan ver qué se ha prometido, quién lo prometió y cuándo.</p>
  <p class="actions">
    <a class="btn" href="{{ '/timeline/' | loc | relative_url }}">Ver la cronología</a>
    <a class="btn ghost" href="{{ '/documents/' | loc | relative_url }}">Explorar todos los documentos</a>
    <a class="btn ghost" href="{{ '/search/' | loc | relative_url }}">Buscar en el texto</a>
  </p>
</section>

<section class="cols">
  <div>
    <h2>Qué hacemos</h2>
    <p>Publicamos los registros públicos exactamente como la ciudad los entregó. Junto a cada uno agregamos un resumen en lenguaje sencillo, escrito por IA (vea <a href="{{ '/about/' | loc | relative_url }}">Acerca de</a>), la fecha y un enlace a su origen. Decimos qué muestran los documentos y qué dejan fuera.</p>
  </div>
  <div>
    <h2>Qué no hacemos</h2>
    <p>No adivinamos motivos ni llenamos los vacíos. Si falta un registro, está tachado o no se entiende, lo decimos. Las correcciones son bienvenidas y las publicamos.</p>
  </div>
  <div>
    <h2>Por qué importa</h2>
    <p>Las decisiones sobre el terreno, el agua, la electricidad y el dinero de los impuestos se están tomando ahora. Los registros públicos pertenecen al público, y el público debería poder leerlos sin tener que presentar una solicitud de registros.</p>
  </div>
</section>

<section class="overview" markdown="1">
## Lo que muestran los registros hasta ahora
<p class="overview-meta">Abarca registros hasta el {{ site.overview_through | fdate: 'long' }} &middot; Última revisión: {{ site.overview_reviewed | fdate: 'long' }} &middot; Escrito por IA (<a href="{{ '/about/#how-we-work' | loc | relative_url }}">cómo trabajamos</a>){% if page.es_reviewed %} &middot; {{ 'es_reviewed_note' | t }}{% else %} &middot; {{ 'es_unreviewed_note' | t }}{% endif %}</p>

**El proyecto.** El Proyecto Hawkeye es un campus de centro de datos propuesto en unos 760 acres al sur de la Interestatal 90, fuera de los límites de la ciudad. El desarrollador, Datawatt Energy, dice que el terreno tiene zonificación agrícola y está bajo contrato con un único propietario. [Su presentación de diapositivas]({{ '/timeline/' | loc | relative_url }}#2024-11-25-developer-brief-jobs-investment-estimates), enviada a la ciudad en noviembre de 2024, apunta a 1,000 megavatios o más, conectados a una línea de ComEd de 345 kV. Calcula más de 3,000 empleos, $3.0 mil millones de dólares de inversión y de $3 a $5 millones de dólares en ingresos por impuestos a la propiedad e impuestos locales, sin indicar un período. La presentación dice que todas las cifras son solo estimaciones.

**Electricidad y agua.** Ambas surgen una y otra vez. [En febrero de 2025]({{ '/timeline/' | loc | relative_url }}#2025-02-10-comed-power-could-take-six-years), el desarrollador le dijo a la ciudad que ComEd sugería que la electricidad podría tardar más de seis años en llegar después de una solicitud, y que Datawatt buscaba maneras de abastecer el sitio sin ComEd. [Sobre el agua y el alcantarillado]({{ '/timeline/' | loc | relative_url }}#2024-12-09-water-and-sewer-routes-annexation-preferred), la ciudad y los ingenieros del desarrollador hablaron de rutas, anexión y capacidad. [En junio de 2025]({{ '/timeline/' | loc | relative_url }}#2025-06-05-manhard-asks-about-water-sewer-and-incentives), el ingeniero del desarrollador escribió que espera un sistema enfriado principalmente por aire, con una pequeña posibilidad de uno enfriado por agua que necesitaría varios millones de galones al día.

**La anexión y la ciudad.** [En diciembre de 2024]({{ '/timeline/' | loc | relative_url }}#2024-12-09-water-and-sewer-routes-annexation-preferred), el abogado de la ciudad les dijo a los representantes del desarrollador que se prefería la anexión, si era factible, tanto para el agua como para el alcantarillado. En mayo de 2025, el alcalde le envió a Datawatt [una carta]({{ '/documents/letter-of-support/' | loc | relative_url }}) con membrete de la ciudad en la que expresaba “enthusiastic interest” (“interés entusiasta”) en el proyecto y animaba a reunirse con el personal de la ciudad para hablar de anexión y zonificación. JLL, la representante del desarrollador, le había enviado al alcalde [un borrador de carta]({{ '/timeline/' | loc | relative_url }}#2025-05-19-jll-sends-draft-letter-of-support) tres días antes y le pidió que se lo devolviera a tiempo para presentarlo con la solicitud del desarrollador a ComEd. El borrador en sí no está en los registros.

**El dinero.** En mayo de 2026, la ciudad y el desarrollador firmaron [un acuerdo de reembolso]({{ '/documents/expense-reimbursement-agreement/' | loc | relative_url }}), con fecha del 26 de mayo. Datawatt Hyperscale LLC se compromete a pagar los costos externos de ingeniería, asesoría legal y consultoría que tenga la ciudad por revisar y negociar el proyecto, contados desde el 1 de abril de 2026, y a depositar una garantía en efectivo de $150,000 que la ciudad puede utilizar si hay facturas sin pagar. El acuerdo dice que no obliga a la ciudad a continuar el proceso. [El día antes de que el desarrollador firmara]({{ '/timeline/' | loc | relative_url }}#2026-05-20-mayor-met-with-developer-city-attorney-notifies-counsel), el 20 de mayo de 2026, el abogado de la ciudad le escribió por correo a la representación legal del desarrollador que el alcalde y el desarrollador habían hablado del borrador del acuerdo y de la postura de la ciudad, y que quería mantenerla al tanto. [Un correo del 18 de junio]({{ '/timeline/' | loc | relative_url }}#2026-06-18-wire-instructions-sent-150015-ready) dice que una transferencia de $150,015 estaba lista una vez que se confirmaran verbalmente las instrucciones de transferencia. Los registros no muestran si se envió.

**Concejales y residentes.** Los registros más recientes, del 4 de septiembre al 26 de octubre de 2026, tratan sobre todo del concejo y del público. Ninguno de esos mensajes es del desarrollador ni para el desarrollador. [El 21 de octubre]({{ '/timeline/' | loc | relative_url }}#2026-10-21-two-aldermen-ask-to-put-project-hawkeye-on-the-october-26-agenda) dos concejales, Ric Brereton y John Albertini, escribieron al alcalde, al abogado de la ciudad y a la secretaría municipal para pedir que el Proyecto Hawkeye se incluyera en la agenda del Comité Plenario del 26 de octubre. [Residentes escribieron]({{ '/timeline/' | loc | relative_url }}#2026-10-15-resident-asks-for-a-public-question-and-answer-item-on-the-agenda) a la secretaría municipal, al alcalde y a los concejales para pedir un punto de preguntas y respuestas con el público, y [una persona le envió a Ric Brereton]({{ '/timeline/' | loc | relative_url }}#2026-10-25-resident-shares-a-list-of-questions-with-alderman-brereton) una larga lista de preguntas sobre el agua, la electricidad, las exenciones fiscales y los contactos de la ciudad con el desarrollador. En [un intercambio de correos del 4 de septiembre]({{ '/timeline/' | loc | relative_url }}#2026-09-04-alderman-peterson-and-a-resident-trade-emails-about-data-centers), el concejal Rory Peterson le escribió a una persona residente que estaba haciendo la tarea para ver si un centro de datos encaja aquí, “definitely without any tax breaks at all” (“definitivamente sin ninguna exención fiscal”).

**La carta del desarrollador.** [El 29 de octubre]({{ '/documents/datawatt-letter-to-council/' | loc | relative_url }}), David Halligan, de Datawatt Energy, envió por correo al alcalde y al abogado de la ciudad una carta dirigida al alcalde y al Concejo Municipal, con dos estimaciones de impuestos a la propiedad a 20 años que el correo califica de preliminares. La carta dice que saber si ComEd y PJM pueden suministrar la electricidad es su “most critical priority” (“prioridad más crítica”) y que “without that answer there is no Project Hawkeye” (“sin esa respuesta no hay Proyecto Hawkeye”). Dice que no se ha presentado ninguna solicitud a la ciudad, que el campus usaría enfriamiento de circuito cerrado, que Datawatt “will not ask the City for tax incentives” (“no pedirá incentivos fiscales a la Ciudad”) y que celebrará un foro público abierto en Belvidere. Estas son declaraciones del propio desarrollador. Las tablas de impuestos están demasiado borrosas en el escaneo para leerlas con certeza; consulte el PDF.

**Lo que los registros no muestran.** Una solicitud o petición formal de anexión o de zonificación. Cualquier acción del Concejo Municipal, de un comité o de una audiencia pública. Cualquier incentivo ofrecido o acordado, aunque el desarrollador ha pedido hablar de incentivos. Lo que se dijo en las muchas llamadas y reuniones que programan los correos. El último correo que programa conversaciones con el desarrollador es una llamada de “Utility Discussion” (“Conversación sobre servicios públicos”) fijada para el 27 de julio de 2026; el siguiente elemento del desarrollador en los registros es su carta del 29 de octubre. La respuesta de la ciudad a esa carta no está en los registros, ni tampoco la agenda y el resultado de la reunión del Comité Plenario del 26 de octubre. Vea [la cronología completa]({{ '/timeline/' | loc | relative_url }}).
</section>

<section>
  <h2>Últimos documentos</h2>
  <ul class="doclist">
    {% assign latest = site.documents | sort: "date" | reverse %}
    {% for d in latest limit: 5 %}
    <li>
      {% include date.html d=d.date undated=d.undated %}
      <a href="{{ d.url | loc | relative_url }}">{{ d | tx: 'title' }}</a>
      {% include badge.html type=d.type %}
    </li>
    {% endfor %}
  </ul>
  <p><a href="{{ '/documents/' | loc | relative_url }}">Los {{ site.documents.size }} documentos →</a></p>
</section>
