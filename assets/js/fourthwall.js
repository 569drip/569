/* V.VI.IX — Fourthwall Storefront API */
(function () {
  "use strict";

  var cfg = window.FW_CONFIG || {};
  var TOKEN = cfg.storefrontToken || "";
  var API = "https://storefront-api.fourthwall.com/v1";
  var CHECKOUT = String(cfg.checkoutDomain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  var DEFAULT_CURRENCY = cfg.currency || "USD";
  var CURRENCY_KEY = "vviix.currency.v2";
  var CART_KEY = "vviix.fourthwall.cart.v1";
  var CACHE_KEY = "vviix.fourthwall.products.v3";
  var CURRENCY_OPTIONS = ["USD","CAD","EUR","GBP","AUD","NZD","SEK","NOK","DKK","PLN","INR","JPY","MYR","SGD","MXN","BRL","CHF"];
  var CURRENCY_NAMES = {
    USD:"US Dollar", CAD:"Canadian Dollar", EUR:"Euro", GBP:"British Pound", AUD:"Australian Dollar", NZD:"New Zealand Dollar",
    SEK:"Swedish Krona", NOK:"Norwegian Krone", DKK:"Danish Krone", PLN:"Polish Zloty", INR:"Indian Rupee", JPY:"Japanese Yen",
    MYR:"Malaysian Ringgit", SGD:"Singapore Dollar", MXN:"Mexican Peso", BRL:"Brazilian Real", CHF:"Swiss Franc"
  };
  var COUNTRY_CURRENCY = {
    CA:"CAD", US:"USD", GB:"GBP", IE:"EUR", AU:"AUD", NZ:"NZD", JP:"JPY", IN:"INR", MY:"MYR", SG:"SGD", MX:"MXN", BR:"BRL",
    SE:"SEK", NO:"NOK", DK:"DKK", PL:"PLN", CH:"CHF", AT:"EUR", BE:"EUR", BG:"EUR", CY:"EUR", CZ:"EUR", DE:"EUR", EE:"EUR",
    ES:"EUR", FI:"EUR", FR:"EUR", GR:"EUR", HR:"EUR", IT:"EUR", LT:"EUR", LU:"EUR", LV:"EUR", MT:"EUR", NL:"EUR", PT:"EUR",
    SI:"EUR", SK:"EUR", IS:"EUR", LI:"CHF"
  };
  var CURRENCY = getStoredCurrency() || detectCurrency();
  // Remove the legacy local cart so it can never conflict with Fourthwall.
  try { localStorage.removeItem("vviix.cart.v1"); } catch (e) {}

  function configured() { return !!TOKEN && TOKEN.indexOf("PASTE_YOUR_") !== 0; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]); }); }
  function slug(p) { return p.slug || p.handle || ""; }
  function name(p) { return p.name || p.title || "Untitled"; }
  function drop() { return window.VVIIXDrop || null; }
  function dropName() { var d = drop(); return (d && d.name) || "V.VI.IX"; }
  function dropText(key) { var d = drop(); return d && d.text ? d.text(key) : null; }
  function collectionSlug() { var d = drop(); return (d && d.collection) || "all"; }

  function getStoredCurrency() {
    try { var v = localStorage.getItem(CURRENCY_KEY); return CURRENCY_OPTIONS.indexOf(v) >= 0 ? v : ""; } catch (e) { return ""; }
  }
  function detectCurrency() {
    var country = window.VVIIXCountry || "";
    var region = document.querySelector("[data-region]");
    if (!country && region && region.dataset.country) country = region.dataset.country;
    if (!country) {
      try {
        var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Montreal|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Yellowknife)/.test(zone)) country = "CA";
        else if (/^America\/(New_York|Detroit|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Honolulu)/.test(zone)) country = "US";
        else if (zone === "Europe/London") country = "GB";
        else if (zone === "Asia/Tokyo") country = "JP";
        else if (/^Asia\/(Kolkata|Calcutta)$/.test(zone)) country = "IN";
        else if (/^Australia\//.test(zone)) country = "AU";
        else if (/^Pacific\/(Auckland|Chatham)$/.test(zone)) country = "NZ";
        else if (/^Asia\/(Singapore)$/.test(zone)) country = "SG";
        else if (/^Asia\/(Kuala_Lumpur|Kuching)$/.test(zone)) country = "MY";
      } catch (e) {}
    }
    return COUNTRY_CURRENCY[country] || DEFAULT_CURRENCY;
  }
  function currencyLabel(code) { return code + " — " + (CURRENCY_NAMES[code] || code); }
  function money(price) {
    if (!price) return "";
    var n = typeof price === "number" ? price : Number(price.value || 0);
    var c = typeof price === "object" && price.currency ? price.currency : CURRENCY;
    try { return new Intl.NumberFormat(undefined, { style:"currency", currency:c }).format(n); } catch (e) { return c + " " + n; }
  }
  function variantPrice(v) { return v && v.unitPrice ? v.unitPrice : null; }
  function price(p, v) { return money(variantPrice(v) || p.price || (p.variants && p.variants[0] && p.variants[0].unitPrice)); }
  function available(p) { return !p.state || p.state.type === "AVAILABLE"; }
  function variantAvailable(v) {
    if (!v) return false;
    if (v.state && v.state.type) return v.state.type === "AVAILABLE";
    if (v.stock) {
      if (v.stock.type === "OUT_OF_STOCK" || v.stock.type === "SOLD_OUT") return false;
      if (typeof v.stock.inStock === "number") return v.stock.inStock > 0;
      if (typeof v.stock.inStock === "boolean") return v.stock.inStock;
    }
    return v.available !== false;
  }
  function variantAttributes(v) {
    var a = v && v.attributes ? v.attributes : {}, out = [];
    Object.keys(a).forEach(function (key) {
      var val = a[key]; if (val == null) return;
      var value = typeof val === "object" ? (val.name || val.value || val.label || "") : String(val);
      if (value) out.push({ name:key, value:value, swatch:typeof val === "object" ? (val.swatch || "") : "" });
    });
    return out;
  }
  function variantOptions(v) {
    var out = variantAttributes(v);
    if (Array.isArray(v && v.options)) v.options.forEach(function (o) { if (o) out.push({name:o.name || o.label || "Option", value:o.value || o.label || "", swatch:o.swatch || ""}); });
    if (v && v.optionValues) Object.keys(v.optionValues).forEach(function (k) { out.push({name:k, value:v.optionValues[k], swatch:""}); });
    return out;
  }
  function optionValues(variants, matcher) {
    var out = [];
    variants.forEach(function (v) { variantOptions(v).forEach(function (o) { if (matcher(o.name) && o.value && out.indexOf(o.value) < 0) out.push(o.value); }); });
    return out;
  }
  function optionSwatch(variants, value) {
    for (var i=0;i<variants.length;i++) for (var j=0;j<variantOptions(variants[i]).length;j++) {
      var o=variantOptions(variants[i])[j]; if (/color|colour/i.test(o.name) && o.value===value && o.swatch) return o.swatch;
    }
    return "";
  }
  function imgs(p) {
    var raw = p.images || p.media || p.productImages || [], out=[];
    raw.forEach(function(x){var u=typeof x==="string"?x:(x&&(x.transformedUrl||x.url||x.src||x.imageUrl||x.href));if(u&&out.indexOf(u)<0)out.push(u);});
    (p.variants||[]).forEach(function(v){(v.images||[]).forEach(function(x){var u=typeof x==="string"?x:(x&&(x.transformedUrl||x.url||x.src||x.imageUrl||x.href));if(u&&out.indexOf(u)<0)out.push(u);});});
    return out;
  }
  function cartId(){try{return localStorage.getItem(CART_KEY)||"";}catch(e){return "";}}
  function setCartId(id){try{if(id)localStorage.setItem(CART_KEY,id);else localStorage.removeItem(CART_KEY);}catch(e){}}

  function api(path, options) {
    options=options||{}; var sep=path.indexOf("?")>=0?"&":"?";
    var url=API+path+sep+"storefront_token="+encodeURIComponent(TOKEN)+"&currency="+encodeURIComponent(CURRENCY);
    return fetch(url,options).then(function(r){return r.text().then(function(t){var d={};try{d=t?JSON.parse(t):{};}catch(e){}if(!r.ok)throw new Error("Fourthwall API "+r.status+(d.message?": "+d.message:""));return d;});});
  }
  function cacheKey(){return CACHE_KEY+"."+collectionSlug()+"."+CURRENCY;}
  // Reads the collection named in drop.json, following every page rather than stopping at 50.
  function getProducts(){
    if(!configured())return Promise.reject(new Error("Fourthwall Storefront token is not configured."));
    var col=collectionSlug(),all=[];
    function page(n){return api("/collections/"+encodeURIComponent(col)+"/products?page="+n+"&size=50").then(function(d){all=all.concat(d.results||[]);var pg=d.paging||{};return pg.hasNextPage&&n<19?page(n+1):all;});}
    return page(0).then(function(p){try{localStorage.setItem(cacheKey(),JSON.stringify(p));}catch(e){}return p;});
  }
  function getCached(){try{return JSON.parse(localStorage.getItem(cacheKey())||"[]");}catch(e){return[];}}

  function renderCurrencyPicker() {
    if (document.querySelector("[data-currency-picker]")) return;
    var cartLink=document.querySelector('a[aria-label="Cart"]'); if(!cartLink) return;
    var wrap=document.createElement("label"); wrap.className="flex items-center gap-2 label !tracking-[0.12em]";
    wrap.innerHTML='<span class="sr-only">Currency</span><select data-currency-picker aria-label="Currency" class="bg-transparent text-paper border-0 cursor-pointer text-[11px] uppercase font-mono min-h-[44px] px-1"></select>';
    cartLink.parentNode.insertBefore(wrap,cartLink);
    var select=wrap.querySelector("select");
    CURRENCY_OPTIONS.forEach(function(c){var o=document.createElement("option");o.value=c;o.textContent=c;o.title=currencyLabel(c);o.setAttribute("aria-label",currencyLabel(c));o.selected=c===CURRENCY;select.appendChild(o);});
    select.addEventListener("change",function(){changeCurrency(select.value,select);});
  }
  function cartItemCount(cart){return (cart&&cart.items||[]).reduce(function(n,i){return n+(Number(i.quantity)||0);},0);}
  function getCart(){var id=cartId();if(!id)return Promise.resolve({items:[]});return api("/carts/"+encodeURIComponent(id)).catch(function(){setCartId("");return {items:[]};});}
  function createCart(items){
    var body={items:items||[]};
    return api("/carts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(c){
      if(!c||!c.id) throw new Error("Fourthwall did not return a cart ID.");
      setCartId(c.id);
      return c;
    });
  }
  function ensureCart(){
    var id=cartId();
    if(!id) return Promise.resolve(null);
    return getCart().then(function(c){return c&&c.id?c.id:null;});
  }
  function addToCart(items){
    return ensureCart().then(function(id){
      if(!id){
        // Fourthwall supports creating a cart with the first line item. This avoids
        // relying on an empty-cart creation request, which can be rejected.
        return createCart(items);
      }
      return api("/carts/"+encodeURIComponent(id)+"/add",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({items:items})
      }).then(function(cart){
        if(cart&&cart.id) setCartId(cart.id);
        return cart;
      });
    }).then(function(cart){
      if(!cart || !Array.isArray(cart.items)) throw new Error("Fourthwall returned an invalid cart response.");
      return cart;
    });
  }
  function changeCart(items){var id=cartId();if(!id)return Promise.reject(new Error("Cart is empty."));return api("/carts/"+encodeURIComponent(id)+"/change",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:items})});}
  function removeFromCart(variantId,bundleId){var id=cartId();if(!id)return Promise.resolve({items:[]});return api("/carts/"+encodeURIComponent(id)+"/remove",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:[{variantId:variantId,bundleId:bundleId}]})});}
  function checkout(){var id=cartId();if(!id){location.href="cart.html";return;}if(!CHECKOUT){alert("Checkout is not configured.");return;}var q=new URLSearchParams({cartCurrency:CURRENCY,cartId:id});location.href="https://"+CHECKOUT+"/checkout/?"+q.toString();}
  function updateCartUI(){getCart().then(function(cart){var count=cartItemCount(cart);document.querySelectorAll("[data-cart-count]").forEach(function(el){el.hidden=count<1;el.textContent=count?String(count):"";});document.querySelectorAll("[data-cart-label]").forEach(function(el){el.textContent=count?"Cart, "+count+" item"+(count===1?"":"s"):"Cart, empty";});}).catch(function(){});}

  function changeCurrency(next, select){
    if(CURRENCY_OPTIONS.indexOf(next)<0||next===CURRENCY)return;
    getCart().then(function(cart){
      if(cartItemCount(cart)>0){
        if(!window.confirm("Changing currency will clear your current cart. Continue?")){if(select)select.value=CURRENCY;return;}
      }
      setCartId(""); CURRENCY=next; try{localStorage.setItem(CURRENCY_KEY,CURRENCY);}catch(e){}
      document.querySelectorAll("[data-currency-picker]").forEach(function(s){s.value=CURRENCY;});
      getProducts().then(function(products){
        var grid=document.querySelector("[data-grid]");if(grid)initShop(products);
        var featured=document.querySelector("[data-featured-products]");if(featured)initHome(products);
        var slugParam=new URLSearchParams(location.search).get("slug");if(slugParam)initProduct(products);
        var cart=document.querySelector("[data-cart-page]");if(cart)renderCartPage();
      }).catch(function(){location.reload();});
      updateCartUI();
    });
  }

  function renderCard(p,opts){
    opts=opts||{};var image=imgs(p)[0],sold=!available(p),card=document.createElement("article");card.className="group reveal";card.dataset.productSlug=slug(p);
    var href="product.html?slug="+encodeURIComponent(slug(p));
    var label=p.productType||p.category||(p.type==="BUNDLE"?"Bundle":dropName());
    card.innerHTML='<a href="'+href+'" class="block"><div class="card-media bg-[#f2f2f2]">'+(sold?'<span class="absolute top-3 left-3 z-10 label !text-ink bg-paper px-2 py-1 !tracking-[0.12em]">Sold out</span>':'')+'<div class="card-art !bg-[#f2f2f2]">'+(image?'<img src="'+esc(image)+'" alt="'+esc(name(p))+'" class="w-full h-full object-contain opacity-100">':'<span class="display text-ink text-center px-6">'+esc(name(p))+'</span>')+'</div></div><div class="flex items-start justify-between gap-4 mt-4"><div><h3 class="font-medium text-paper">'+esc(name(p))+'</h3><p class="label !text-gray4 !tracking-[0.12em] mt-1">'+esc(label)+'</p></div><p class="font-mono text-paper shrink-0">'+esc(price(p))+'</p></div></a>';
    if(opts.container){opts.container.appendChild(card);requestAnimationFrame(function(){card.classList.add("is-visible");});}return card;
  }
  function setupFilters(products){var filters=document.querySelector("[data-filters]");if(!filters)return;var buttons=[].slice.call(filters.querySelectorAll("[data-filter]")),cats={all:products.length};products.forEach(function(p){var t=String(p.productType||p.category||"").toLowerCase(),cat=t.indexOf("hood")>=0?"hoodies":t.indexOf("lingerie")>=0?"lingerie":t.indexOf("access")>=0?"accessories":t.indexOf("tee")>=0||t.indexOf("shirt")>=0?"tees":"other";p.__category=cat;cats[cat]=(cats[cat]||0)+1;});buttons.forEach(function(b){var c=b.querySelector("span");if(c)c.textContent=String(cats[b.dataset.filter]||0);if(b.dataset.filter!=="all"&&!cats[b.dataset.filter])b.hidden=true;});}
  function initShop(products){var grid=document.querySelector("[data-grid]");if(!grid)return;grid.innerHTML="";if(!products.length){grid.innerHTML='<p class="col-span-full text-gray4">'+esc(dropText("live_empty")||"No pieces are available right now.")+'</p>';return;}products.forEach(function(p){renderCard(p,{container:grid});});setupFilters(products);[].slice.call(grid.querySelectorAll("article")).forEach(function(card,i){if(products[i])card.dataset.cat=products[i].__category||"other";});}
  function initHome(products){var section=document.querySelector("[data-featured-products]");if(!section)return;section.innerHTML="";products.slice(0,6).forEach(function(p){renderCard(p,{container:section});});}
  function setPressed(group,value,input){group.querySelectorAll("button[data-value]").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.value===value));});if(input)input.value=value;}

  function initProduct(products){
    var form=document.querySelector("form[data-add-to-cart]");if(!form)return;var sp=new URLSearchParams(location.search).get("slug");if(!sp)return;var p=products.find(function(x){return slug(x)===sp;})||getCached().find(function(x){return slug(x)===sp;});if(!p){showProductError();return;}
    var title=name(p),variants=(p.variants||[]).filter(variantAvailable);var titleEl=document.getElementById("p-title");if(titleEl)titleEl.textContent=title;document.title=title+" — V.VI.IX";
    var plainDescription=String(p.description||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();var meta=document.querySelector('meta[name="description"]');if(meta&&plainDescription)meta.setAttribute("content",plainDescription.slice(0,155));var descEl=document.querySelector("[data-product-description]");if(descEl)descEl.textContent=plainDescription||"A V.VI.IX piece from the current collection.";var kicker=document.querySelector("[data-product-kicker],[data-product-type]");if(kicker)kicker.textContent=dropName();
    var priceEl=document.querySelector("[data-price-display]");form.dataset.fwProduct=p.id||"";form._fwVariants=variants;
    var gallery=document.querySelector("[data-product-gallery]"),mainImg=document.querySelector("[data-product-image]"),galleryImages=imgs(p);
    function showImage(url,btn){if(mainImg&&url){mainImg.src=url;mainImg.alt=title;mainImg.style.opacity="1";}if(gallery)gallery.querySelectorAll("button[data-gallery-image]").forEach(function(b){b.setAttribute("aria-pressed",String(b===btn));b.classList.toggle("border-paper",b===btn);b.classList.toggle("border-transparent",b!==btn);});}
    if(gallery&&galleryImages.length){gallery.innerHTML=galleryImages.map(function(u,i){return '<button type="button" data-gallery-image data-url="'+esc(u)+'" aria-label="View product image '+(i+1)+'" aria-pressed="'+(i===0?'true':'false')+'" class="border '+(i===0?'border-paper':'border-transparent')+' overflow-hidden bg-[#f7f7f7] aspect-square"><img src="'+esc(u)+'" alt="'+esc(title)+' — image '+(i+1)+'" class="w-full h-full object-contain"></button>';}).join("");gallery.addEventListener("click",function(e){var b=e.target.closest("button[data-gallery-image]");if(b)showImage(b.dataset.url,b);});showImage(galleryImages[0],gallery.querySelector("button[data-gallery-image]"));}else if(mainImg&&galleryImages[0])showImage(galleryImages[0]);
    var sizeGroup=form.querySelector('[data-toggle-group="f-size"]'),colorGroup=form.querySelector('[data-toggle-group="f-color"]'),sizeInput=document.getElementById("f-size"),colorInput=document.getElementById("f-color"),sizes=optionValues(variants,function(n){return /size/i.test(n);}),colors=optionValues(variants,function(n){return /color|colour/i.test(n);});
    if(sizeGroup)sizeGroup.innerHTML=sizes.length?sizes.map(function(v){return '<button type="button" class="size-btn" aria-pressed="false" data-value="'+esc(v)+'" data-size="'+esc(v)+'">'+esc(v)+'</button>';}).join(""):'<span class="label !text-gray4">One size</span>';
    if(colorGroup)colorGroup.innerHTML=colors.length?colors.map(function(v,i){var sw=optionSwatch(variants,v);return '<button type="button" class="swatch" aria-pressed="'+(i===0?'true':'false')+'" data-value="'+esc(v)+'" aria-label="'+esc(v)+'" title="'+esc(v)+'"'+(sw?' style="background:'+esc(sw)+'"':'')+'></button>';}).join(""):'<span class="label !text-gray4">Standard</span>';
    if(colorInput)colorInput.value=colors[0]||"";if(sizeInput)sizeInput.value=sizes[0]||"";if(sizes.length&&sizeGroup)setPressed(sizeGroup,sizes[0],sizeInput);
    function matches(v){var vals=variantOptions(v),size=sizeInput&&sizeInput.value,color=colorInput&&colorInput.value,hasSize=vals.some(function(x){return /size/i.test(x.name);}),hasColor=vals.some(function(x){return /color|colour/i.test(x.name);});return(!hasSize||vals.some(function(x){return /size/i.test(x.name)&&x.value===size;}))&&(!hasColor||vals.some(function(x){return /color|colour/i.test(x.name)&&x.value===color;}));}
    function updateAvailability(){if(sizeGroup)sizeGroup.querySelectorAll("button[data-size]").forEach(function(b){var ok=variants.some(function(v){var vals=variantOptions(v),co=!colorInput.value||!vals.some(function(x){return /color|colour/i.test(x.name);})||vals.some(function(x){return /color|colour/i.test(x.name)&&x.value===colorInput.value;});return co&&vals.some(function(x){return /size/i.test(x.name)&&x.value===b.dataset.size;});});b.disabled=!ok;b.classList.toggle("opacity-30",!ok);});if(colorGroup)colorGroup.querySelectorAll("button[data-value]").forEach(function(b){var ok=variants.some(function(v){var vals=variantOptions(v);return vals.some(function(x){return /color|colour/i.test(x.name)&&x.value===b.dataset.value;})&&(!sizeInput.value||vals.some(function(x){return /size/i.test(x.name)&&x.value===sizeInput.value;}));});b.disabled=!ok;b.classList.toggle("opacity-30",!ok);});}
    function selectedVariant(){return variants.find(matches);}function updateSelectedPrice(){var v=selectedVariant();if(priceEl)priceEl.textContent=price(p,v||variants[0]);}
    updateAvailability();updateSelectedPrice();
    if(colorGroup)colorGroup.addEventListener("click",function(e){var b=e.target.closest("button[data-value]");if(!b)return;setPressed(colorGroup,b.dataset.value,colorInput);updateAvailability();updateSelectedPrice();});
    if(sizeGroup)sizeGroup.addEventListener("click",function(e){var b=e.target.closest("button[data-size]");if(!b)return;setPressed(sizeGroup,b.dataset.size,sizeInput);updateAvailability();updateSelectedPrice();});
    form.addEventListener("submit",function(e){e.preventDefault();var status=form.querySelector("[data-cart-status]"),v=selectedVariant();if(!v){if(status)status.textContent="Choose an available colour and size.";return;}if(status)status.textContent="Adding…";addToCart([{variantId:v.id,quantity:1}]).then(function(){if(status)status.textContent="Added to cart.";updateCartUI();}).catch(function(err){console.error(err);if(status)status.textContent="Could not add this item. Try again.";});});
  }
  function showProductError(){var main=document.querySelector("#main");if(main)main.innerHTML='<section class="shell edge py-24"><p class="label accent-text">Product not found</p><h1 class="display mt-4">That piece is no longer available.</h1><a class="btn btn-primary mt-8 inline-flex" href="shop.html">Back to shop</a></section>';}

  function renderCartPage(){
    var root=document.querySelector("[data-cart-page]");if(!root)return;
    getCart().then(function(cart){
      var items=cart.items||[],count=cartItemCount(cart),currency=(items[0]&&items[0].variant&&items[0].variant.unitPrice&&items[0].variant.unitPrice.currency)||CURRENCY;
      if(!items.length){root.innerHTML='<section class="shell edge py-[clamp(4rem,12vh,8rem)] text-center"><p class="label accent-text">Your cart</p><h1 class="display text-[clamp(2.5rem,7vw,5rem)] mt-5">Nothing here yet<span class="accent">.</span></h1><p class="text-gray4 mt-5">Find something worth saying.</p><a href="shop.html" class="btn btn-primary mt-8 inline-flex">Shop the drop</a></section>';updateCartUI();return;}
      var subtotal=items.reduce(function(sum,it){var p=it.variant&&it.variant.unitPrice?Number(it.variant.unitPrice.value)||0:0;return sum+p*(Number(it.quantity)||0);},0);
      root.innerHTML='<section class="shell edge pt-[clamp(2.5rem,7vh,5rem)] pb-8 border-b border-line"><p class="label accent-text">Your cart</p><h1 class="display display-tight mt-5 text-[clamp(2.5rem,7.5vw,6rem)]">Worth repeating<span class="accent">?</span></h1><p class="prose-narrow text-gray4 font-light mt-5">'+count+' '+(count===1?'item':'items')+'</p></section><section class="shell edge py-[clamp(3rem,8vh,5rem)] grid lg:grid-cols-[1fr_360px] gap-12"><div data-cart-items class="space-y-6"></div><aside class="lg:sticky lg:top-28 h-fit border border-line p-6"><div class="flex justify-between gap-6"><span class="label !text-gray4">Subtotal</span><strong class="font-mono" data-cart-subtotal></strong></div><p class="text-gray4 text-sm mt-3">Shipping and taxes are calculated at checkout.</p><button type="button" class="btn btn-primary btn-block mt-7" data-fw-checkout>Checkout</button><a href="shop.html" class="btn btn-block mt-3 border border-line">Continue shopping</a></aside></section>';
      var list=root.querySelector("[data-cart-items]");list.innerHTML=items.map(function(it,i){var v=it.variant||{},im=(v.images&&v.images[0]&&(v.images[0].transformedUrl||v.images[0].url))||"",attrs=variantOptions(v).filter(function(x){return /color|colour|size/i.test(x.name);}),detail=attrs.map(function(x){return esc(x.value);}).join(" · "),qty=Number(it.quantity)||1;return '<article class="grid grid-cols-[96px_1fr_auto] gap-4 border-b border-line pb-6" data-cart-item data-index="'+i+'"><div class="aspect-square bg-[#f2f2f2] overflow-hidden">'+(im?'<img src="'+esc(im)+'" alt="'+esc((v.product&&v.product.name)||v.name||"")+'" class="w-full h-full object-contain">':'')+'</div><div><a href="product.html?slug='+encodeURIComponent(v.product&&v.product.slug||"")+'" class="font-medium text-paper hover:underline">'+esc((v.product&&v.product.name)||v.name||"Product")+'</a><p class="label !text-gray4 mt-2">'+detail+'</p><p class="font-mono mt-3">'+money(v.unitPrice)+'</p><div class="flex items-center gap-2 mt-4"><button type="button" class="size-btn !min-w-0 !w-9" data-cart-dec aria-label="Decrease quantity">−</button><span class="font-mono w-8 text-center" data-cart-qty>'+qty+'</span><button type="button" class="size-btn !min-w-0 !w-9" data-cart-inc aria-label="Increase quantity">+</button></div></div><button type="button" class="label text-gray4 hover:text-paper self-start" data-cart-remove>Remove</button></article>';}).join("");
      root.querySelector("[data-cart-subtotal]").textContent=money({value:subtotal,currency:currency});
      root.querySelectorAll("[data-cart-item]").forEach(function(row){var i=Number(row.dataset.index),item=items[i],vid=item.variant&&item.variant.id,bid=item.groupedBy&&item.groupedBy.bundleId;row.querySelector("[data-cart-dec]").addEventListener("click",function(){updateItem(vid,Math.max(0,(Number(item.quantity)||1)-1),bid);});row.querySelector("[data-cart-inc]").addEventListener("click",function(){updateItem(vid,(Number(item.quantity)||1)+1,bid);});row.querySelector("[data-cart-remove]").addEventListener("click",function(){removeFromCart(vid,bid).then(renderCartPage);});});
      root.querySelector("[data-fw-checkout]").addEventListener("click",checkout);updateCartUI();
    }).catch(function(){root.innerHTML='<section class="shell edge py-24"><p class="label accent-text">Cart error</p><h1 class="display mt-4">We couldn’t load your cart.</h1><a class="btn btn-primary mt-8 inline-flex" href="shop.html">Back to shop</a></section>';});
  }
  function updateItem(variantId,qty,bundleId){if(qty<=0)return removeFromCart(variantId,bundleId).then(renderCartPage);return changeCart([{variantId:variantId,quantity:qty,bundleId:bundleId}]).then(renderCartPage);}

  function reportToDrop(products){var d=drop();if(d&&d.reportProducts)d.reportProducts({total:products.length,available:products.filter(available).length});}
  var emptyRetries=0;
  function loadAndRender(){
    return getProducts().then(function(products){
      document.documentElement.dataset.fourthwall="connected";
      reportToDrop(products);initShop(products);initHome(products);initProduct(products);renderCartPage();
      // Launch time passed but products still hidden in Fourthwall: check again quietly.
      var d=drop();
      if(!products.length&&d&&d.state==="live"&&emptyRetries<20&&document.querySelector("[data-grid],[data-featured-products]")){emptyRetries++;setTimeout(loadAndRender,30000);}
    }).catch(function(err){console.error("[vviix] Fourthwall connection failed:",err);var products=getCached();if(products.length){reportToDrop(products);initShop(products);initHome(products);initProduct(products);}renderCartPage();});
  }
  function boot(){
    if(!configured()){console.warn("[vviix] Fourthwall Storefront token missing.");return;}
    renderCurrencyPicker();updateCartUI();
    var d=drop();
    if(d&&d.on)d.on(function(state,prev){if(state==="live"&&prev==="countdown"){emptyRetries=0;loadAndRender();}});
    (d&&d.ready?d.ready:Promise.resolve()).then(loadAndRender);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
