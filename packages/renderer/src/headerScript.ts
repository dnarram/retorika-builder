/**
 * The first script a published page carries, and the only one (ADR 0058).
 *
 * **One constant string.** Nothing of the document is interpolated into it — `headerScript.test.ts`
 * renders two documents and asserts the same bytes, and asserts the string holds no `</script`.
 * That is the whole of its security property: a script that is the same on every site of every
 * owner cannot carry anybody's words into a page.
 *
 * **Progressive, and everything it touches works without it.** The `<details>` opens and closes by
 * itself; the anchors land; the bar that is fixed stays fixed; `--rb-header-h` has a CSS estimate.
 * What the script adds, in the order it runs:
 *
 * 0. `data-rb-js` on `<html>` — the mark the stylesheet hangs on for what must not happen without a
 *    script: a transparent bar that is fixed (David's adjustment 1b). Without the mark the bar is
 *    absolute and scrolls away with the cover; with it, it is fixed and turns to `surface` once the
 *    page has scrolled.
 * 1. `--rb-header-h` from the bar's own `offsetHeight`, so an anchor lands under a fixed bar of the
 *    height it really has and not the estimate's.
 * 2. Escape, and a pointer outside, close the phone's open `<details>` and give the focus back to
 *    its `<summary>` — the two things a `<details>` does not do by itself.
 * 3. `data-scrolled` on a fixed bar once the page has scrolled: the stylesheet draws the shadow.
 * 4. The entry of the section most in view carries `aria-current="location"` (an
 *    `IntersectionObserver`; nothing on a browser without one, and nothing wrong either).
 *
 * No network, no `eval`, no state outside the DOM, no reading of anything but the header and the
 * sections the header already links to. Omitted by the `dom` target: the editor's canvas is patched
 * by morphdom, which would fight the attributes this writes, and the editor has its own scroll.
 *
 * Hand-minified rather than built, so what travels is what is read here. The gzip weight is
 * asserted at or under 2 KB in `headerScript.test.ts` and reported by `pnpm size`.
 */
export const HEADER_SCRIPT = [
  "(function(){",
  "var d=document,h=d.documentElement,b=d.querySelector('.rb-header');if(!b)return;",
  "h.setAttribute('data-rb-js','');",
  "var measure=function(){h.style.setProperty('--rb-header-h',b.offsetHeight+'px')};",
  "measure();addEventListener('resize',measure);",
  "var det=b.querySelector('details.rb-nav-narrow');",
  "if(det){var sum=det.querySelector('summary');",
  "d.addEventListener('keydown',function(e){if(e.key==='Escape'&&det.open){det.open=false;if(sum)sum.focus()}});",
  "d.addEventListener('click',function(e){if(det.open&&!det.contains(e.target))det.open=false});}",
  "if(b.hasAttribute('data-sticky')){var scrolled=function(){if(scrollY>0)b.setAttribute('data-scrolled','');else b.removeAttribute('data-scrolled')};",
  "scrolled();addEventListener('scroll',scrolled,{passive:true});}",
  "var links=[].slice.call(b.querySelectorAll('.rb-nav a[href^=\"#\"]')),bySection=new Map(),sections=[];",
  "links.forEach(function(a){var s=d.getElementById(a.getAttribute('href').slice(1));if(!s)return;",
  "if(!bySection.has(s)){bySection.set(s,[]);sections.push(s)}bySection.get(s).push(a)});",
  "if(sections.length&&'IntersectionObserver' in window){var seen=new Map(),mark=function(){",
  "var best=null,most=0;seen.forEach(function(r,s){if(r>most){most=r;best=s}});",
  "links.forEach(function(a){a.removeAttribute('aria-current')});",
  "if(best)bySection.get(best).forEach(function(a){a.setAttribute('aria-current','location')})};",
  "var io=new IntersectionObserver(function(es){es.forEach(function(e){seen.set(e.target,e.isIntersecting?e.intersectionRatio:0)});mark()},",
  "{rootMargin:'-'+b.offsetHeight+'px 0px -40% 0px',threshold:[0,.25,.5,.75,1]});",
  "sections.forEach(function(s){io.observe(s)});}",
  "})();",
].join("");
