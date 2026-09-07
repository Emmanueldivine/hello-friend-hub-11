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
          deadline: deadlineIso(a),
          files: [a.fileName, a.staffFileName]
            .filter(function (n) { return n; })
            .map(function (n) { return String(n).slice(0, 300); }),
        };
      }),
      chats: chats,
    };
  }

  /* Student portal stores either a real date or a number of hours. */
  function deadlineIso(a) {
    var raw = a && a.deadline;
    if (raw === null || raw === undefined || raw === "") return "";
    var hours = Number(raw);
    if (Number.isFinite(hours) && String(raw).length < 6) {
      var start = a.createdAt ? new Date(a.createdAt) : new Date();
      if (isNaN(start.getTime())) start = new Date();
      return new Date(start.getTime() + hours * 3600000).toISOString();
    }
    var d = new Date(raw);
    return isNaN(d.getTime()) ? "" : d.toISOString();
  }

  function accessToken() {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf("sb-") !== 0 || key.indexOf("-auth-token") === -1) continue;
      var session = read(key);
      if (session && typeof session.access_token === "string") return session.access_token;
    }
    return "";
  }

  function sync() {
    var payload = collect();
    if (!payload) return;
    var token = accessToken();
    if (!token) return;
    var signature = JSON.stringify(payload);
    if (signature === LAST) return;
    LAST = signature;
    fetch("/api/public/student-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      body: signature,
    }).catch(function () {
      LAST = "";
    });
  }

  /* Pull delivery updates made by admins/sub-admins so the progress bar
     flips to 100% completed with a download link, without touching the
     progress bar logic itself. */
  function pull() {
    var token = accessToken();
    if (!token) return;
    var u = currentUser();
    var id = uid(u);
    if (!id) return;
    fetch("/api/public/order-status", { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        if (!res || !Array.isArray(res.orders)) return;
        var key = localStorage.getItem("assignments_" + id) !== null
          ? "assignments_" + id
          : "assignments";
        var list = read(key);
        if (!Array.isArray(list) || !list.length) return;
        var changed = false;
        res.orders.forEach(function (o) {
          if (o.status !== "completed" || !o.downloadUrl) return;
          list.forEach(function (a) {
            if (String(a.id) !== String(o.assignmentId)) return;
            if (a.status === "completed" && a.staffFile === o.downloadUrl) return;
            a.status = "completed";
            a.staffFile = o.downloadUrl;
            a.staffFileName = o.fileName || (a.title || "assignment") + ".file";
            a.completedAt = o.completedAt || new Date().toISOString();
            changed = true;
          });
        });
        if (!changed) return;
        setItem(key, JSON.stringify(list));
        window.dispatchEvent(new Event("hashchange"));
      })
      .catch(function () {});
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
  window.addEventListener("load", pull);
  setInterval(sync, 20000);
  setInterval(pull, 4000);
})();
