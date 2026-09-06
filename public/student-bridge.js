/* Unieveryhelp student portal -> backend bridge.
   Mirrors the portal's local data into the shared database so the admin
   portal sees real students, orders, wallets and chats in real time. */
(function () {
  var TIMER = null;
  var LAST = "";

  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function currentUser() {
    return read("currentUser") || read("unieveryhelp_user");
  }

  function uid(u) {
    return u && (u.phone || u.phoneNumber || u.username || u.email || u.id);
  }

  function collect() {
    var u = currentUser();
    if (!u) return null;
    var id = uid(u);
    if (!id) return null;

    var assignments = read("assignments_" + id) || read("assignments") || [];
    var walletRaw = read("wallet_" + id);
    if (walletRaw === null) walletRaw = read("unieveryhelp_wallet");
    var wallet = typeof walletRaw === "number" ? walletRaw : Number(walletRaw && walletRaw.balance) || 0;

    var history = read("history_" + id) || [];
    var transactions = (Array.isArray(history) ? history : []).map(function (h, i) {
      return {
        id: String(h.id || h.reference || id + "-tx-" + i),
        reference: h.reference ? String(h.reference) : undefined,
        amount: h.amount,
        type: h.type || "funding",
        status: h.status || "success",
      };
    });

    var chats = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf("chat_") !== 0) continue;
      var thread = read(key);
      if (!Array.isArray(thread) || !thread.length) continue;
      var msgs = thread
        .filter(function (m) {
          return m && m.type !== "log" && (m.text || m.body);
        })
        .slice(-200)
        .map(function (m) {
          return {
            id: String(m.id || ""),
            from: String(m.from || m.sender || ""),
            text: String(m.text || m.body).slice(0, 4000),
            at: String(m.at || m.time || ""),
          };
        });
      if (!msgs.length) continue;
      chats.push({
        key: key,
        staffName: (thread[0] && thread[0].staffName) || key.split("_").pop(),
        messages: msgs,
      });
    }

    return {
      user: {
        name: u.fullName || u.name || u.username || "",
        email: (u.email || "").trim(),
        phone: String(u.phone || u.phoneNumber || ""),
        school: u.school || u.university || "",
      },
      assignments: (Array.isArray(assignments) ? assignments : []).slice(0, 200).map(function (a) {
        return {
          id: String(a.id || ""),
          title: String(a.title || ""),
          courseCode: String(a.courseCode || a.course || ""),
          description: String(a.description || "").slice(0, 4000),
          price: a.price,
          status: String(a.status || "Received"),
          progress: Number(a.progress) || 0,
          createdAt: String(a.createdAt || ""),
        };
      }),
      wallet: wallet,
      transactions: transactions,
      chats: chats,
    };
  }

  function sync() {
    var payload = collect();
    if (!payload) return;
    var signature = JSON.stringify(payload);
    if (signature === LAST) return;
    LAST = signature;
    fetch("/api/public/student-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: signature,
    }).catch(function () {
      LAST = "";
    });
  }

  function schedule() {
    clearTimeout(TIMER);
    TIMER = setTimeout(sync, 800);
  }

  var setItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    setItem(key, value);
    schedule();
  };

  window.addEventListener("load", schedule);
  setInterval(sync, 20000);
})();
