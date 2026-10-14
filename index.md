---
layout: default
title: Home
---
<section class="hero">
  <p class="eyebrow">Community records project</p>
  <h1>Our Mayor Is Considering a Data Center. We're Reading Every Page So You Can Too.</h1>
  <p class="lede">The city has released agreements, emails and plans about a proposed data center. They're scattered, scanned, and hard to search. We gather them in one place, keep our own copy of each one, and put them in order, so residents can see what has been promised, by whom, and when.</p>
  <p class="actions">
    <a class="btn" href="{{ '/timeline/' | relative_url }}">See the Timeline</a>
    <a class="btn ghost" href="{{ '/documents/' | relative_url }}">Browse All Documents</a>
    <a class="btn ghost" href="{{ '/search/' | relative_url }}">Search the Text</a>
  </p>
</section>

<section class="cols">
  <div>
    <h2>What We Do</h2>
    <p>We post public records exactly as the city released them. Next to each one we add a plain-language summary, the date, and a link to where it came from. We say what the documents show and what they leave out.</p>
  </div>
  <div>
    <h2>What We Don't Do</h2>
    <p>We don't guess at motives or fill in blanks. If a record is missing, redacted or unclear, we say so. Corrections are welcome and we publish them.</p>
  </div>
  <div>
    <h2>Why It Matters</h2>
    <p>Decisions about land, water, power and tax money are being made now. Public records belong to the public, and the public should be able to read them without a records request.</p>
  </div>
</section>

<section>
  <h2>Latest Documents</h2>
  <ul class="doclist">
    {% assign latest = site.documents | sort: "date" | reverse %}
    {% for d in latest limit: 5 %}
    <li>
      <time>{% if d.undated %}Undated{% else %}{{ d.date | date: "%b %-d, %Y" }}{% endif %}</time>
      <a href="{{ d.url | relative_url }}">{{ d.title }}</a>
      {% include badge.html type=d.type %}
    </li>
    {% endfor %}
  </ul>
  <p><a href="{{ '/documents/' | relative_url }}">All {{ site.documents.size }} Documents →</a></p>
</section>
