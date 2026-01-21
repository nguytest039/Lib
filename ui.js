// /src/modal-manager.js
/**
 * DKN
 * Bootstrap 5 Modal stack/replace + SweetAlert2 z-index (compact)
 *
 * Usage:
 *   import ModalManager from './modal-manager.js';
 *   ModalManager.init();
 */
'use strict';

const isEl = (v) => v instanceof HTMLElement;
const elOf = (t) => (isEl(t) ? t : typeof t === 'string' ? document.querySelector(t) : null);
const bdList = () => Array.from(document.querySelectorAll('.modal-backdrop'));
const sbw = () => window.innerWidth - document.documentElement.clientWidth;

const esc = (s) =>
    String(s ?? '').replace(
        /[&<>"']/g,
        (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c],
    );

const mustModal = () => {
    const M = window.bootstrap?.Modal;
    if (!M) throw new Error('Bootstrap 5 Modal not found (window.bootstrap.Modal)');
    return M;
};

const bs = (el, opts) => mustModal().getOrCreateInstance(el, opts || {});

const state = {
    inited: false,
    stack: [],
    cfgBackdrop: new WeakMap(),
    zJob: Promise.resolve(),
    lock: {
        count: 0,
        sbw: 0,
        bodyInline: {overflow: '', paddingRight: ''},
        bodyBasePR: 0,
        fixedSel: '.fixed-top, .fixed-bottom, .sticky-top, .is-fixed',
        fixed: new WeakMap(),
    },
    handlers: null,
    zBase: {modal: 1055, backdrop: 1050},
};

const hasBackdrop = (el) => {
    if (state.cfgBackdrop.has(el)) return !!state.cfgBackdrop.get(el);
    const attr = el.getAttribute('data-bs-backdrop');
    if (attr != null) return String(attr).toLowerCase() !== 'false';
    return true;
};

const prepLock = () => {
    const body = document.body;
    const L = state.lock;
    L.sbw = sbw();
    L.bodyInline.overflow = body.style.overflow || '';
    L.bodyInline.paddingRight = body.style.paddingRight || '';
    L.bodyBasePR = parseFloat(getComputedStyle(body).paddingRight) || 0;

    document.querySelectorAll(L.fixedSel).forEach((el) => {
        if (!isEl(el) || L.fixed.has(el)) return;
        L.fixed.set(el, {
            inlinePR: el.style.paddingRight || '',
            basePR: parseFloat(getComputedStyle(el).paddingRight) || 0,
        });
    });
};

const applyLock = () => {
    const body = document.body;
    const L = state.lock;
    const w = L.sbw;

    body.classList.add('modal-open');
    body.style.overflow = 'hidden';
    if (w > 0) body.style.paddingRight = `${L.bodyBasePR + w}px`;

    if (w > 0) {
        document.querySelectorAll(L.fixedSel).forEach((el) => {
            const m = L.fixed.get(el);
            if (!m) return;
            el.style.paddingRight = `${m.basePR + w}px`;
        });
    }
};

const restoreLock = () => {
    const body = document.body;
    const L = state.lock;

    body.classList.remove('modal-open');
    body.style.overflow = L.bodyInline.overflow;
    body.style.paddingRight = L.bodyInline.paddingRight;

    document.querySelectorAll(L.fixedSel).forEach((el) => {
        const m = L.fixed.get(el);
        if (!m) return;
        el.style.paddingRight = m.inlinePR;
        L.fixed.delete(el);
    });

    L.sbw = 0;
    L.bodyBasePR = 0;
};

const lockBody = () => {
    const L = state.lock;
    L.count++;
    if (L.count === 1) prepLock();
    applyLock();
};

const unlockBody = () => {
    const L = state.lock;
    L.count = Math.max(0, L.count - 1);
    if (L.count === 0) restoreLock();
    else applyLock();
};

const add = (el) => {
    if (!state.stack.includes(el)) state.stack.push(el);
};

const remove = (el) => {
    const i = state.stack.indexOf(el);
    if (i >= 0) state.stack.splice(i, 1);
};

const applyZ = () => {
    const step = 10;
    const bds = bdList();
    let j = 0;

    for (let i = 0; i < state.stack.length; i++) {
        const el = state.stack[i];
        el.style.zIndex = String(state.zBase.modal + i * step);
        el.style.pointerEvents = i === state.stack.length - 1 ? '' : 'none';

        if (hasBackdrop(el)) {
            const bd = bds[j] || null;
            if (bd && bd.isConnected) {
                bd.style.zIndex = String(state.zBase.backdrop + i * step);
            }
            j++;
        }
    }
};

const scheduleApplyZ = () => {
    state.zJob = state.zJob.then(applyZ).catch(() => {});
    return state.zJob;
};

const waitHidden = (el, timeoutMs) =>
    new Promise((resolve) => {
        if (!isEl(el) || !state.stack.includes(el)) return resolve();
        let done = false;

        const finish = () => {
            if (done) return;
            done = true;
            el.removeEventListener('hidden.bs.modal', onHidden);
            clearTimeout(t);
            resolve();
        };

        const onHidden = (e) => {
            if (e.target === el) finish();
        };

        const t = setTimeout(finish, timeoutMs);
        el.addEventListener('hidden.bs.modal', onHidden);
    });

const waitAllHidden = (timeoutMs) => Promise.all([...state.stack].map((el) => waitHidden(el, timeoutMs)));

const init = () => {
    if (state.inited) return;
    state.inited = true;

    const onShown = (e) => {
        const el = e.target;
        if (!isEl(el)) return;
        add(el);
        lockBody();
        scheduleApplyZ();
    };

    const onHidden = (e) => {
        const el = e.target;
        if (!isEl(el)) return;
        remove(el);
        unlockBody();
        scheduleApplyZ();
    };

    state.handlers = {onShown, onHidden};
    document.addEventListener('shown.bs.modal', onShown);
    document.addEventListener('hidden.bs.modal', onHidden);
};

const destroy = () => {
    if (!state.inited) return;

    const h = state.handlers;
    if (h) {
        document.removeEventListener('shown.bs.modal', h.onShown);
        document.removeEventListener('hidden.bs.modal', h.onHidden);
    }
    state.handlers = null;
    state.inited = false;

    state.stack.forEach((el) => {
        if (isEl(el)) {
            el.style.pointerEvents = '';
            el.style.zIndex = '';
        }
    });

    state.stack = [];
    state.lock.count = 0;
    restoreLock();
};

const _open = async (target, options = {}) => {
    const el = elOf(target);
    if (!el) return null;

    const {strategy = 'replace', replaceTimeout = 2500, force = false, ...bsOptions} = options;

    if (Object.prototype.hasOwnProperty.call(bsOptions, 'backdrop')) {
        const v = bsOptions.backdrop;
        state.cfgBackdrop.set(el, v !== false && String(v).toLowerCase() !== 'false');
    } else {
        state.cfgBackdrop.delete(el);
    }

    if (strategy === 'replace' && state.stack.length) {
        closeAll();
        await waitAllHidden(replaceTimeout);
        if (state.stack.length && !force) return null;
    }

    const inst = bs(el, bsOptions);
    inst.show();
    return inst;
};

const close = (target) => {
    const el = elOf(target);
    if (!el) return;
    try {
        bs(el).hide();
    } catch (_) {}
};

const closeTop = () => {
    const t = state.stack[state.stack.length - 1];
    if (t) close(t);
};

const closeAll = () => {
    [...state.stack].reverse().forEach((el) => {
        try {
            bs(el).hide();
        } catch (_) {}
    });
};

const isOpen = (target) => {
    const el = elOf(target);
    return !!el && state.stack.includes(el);
};

const getStack = () => [...state.stack];

const swal = () => window.Swal || null;
const topZ = () => (state.stack.length ? state.zBase.modal + (state.stack.length - 1) * 10 : 9999);

const withSwalZ = (opts = {}) => {
    const z = topZ() + 20;
    const didOpen0 = opts.didOpen;
    return {
        ...opts,
        didOpen: (popup) => {
            const c = popup?.closest?.('.swal2-container') || document.querySelector('.swal2-container');
            if (c) c.style.zIndex = String(z);
            if (didOpen0) didOpen0(popup);
        },
    };
};

const alert = (opts = {}) => {
    const S = swal();
    if (!S) {
        window.alert(opts.title || opts.text || 'Alert');
        return Promise.resolve({isConfirmed: true});
    }
    return S.fire(withSwalZ({icon: 'info', confirmButtonText: 'OK', ...opts}));
};

const confirm = (opts = {}) => {
    const S = swal();
    if (!S) return Promise.resolve({isConfirmed: window.confirm(opts.title || opts.text || 'Confirm?')});
    return S.fire(
        withSwalZ({
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'OK',
            cancelButtonText: 'Cancel',
            ...opts,
        }),
    );
};

const toast = (opts = {}) => {
    const S = swal();
    if (!S) {
        console.log('Toast:', opts.title || opts.text || 'Notification');
        return Promise.resolve({});
    }
    const {title, text, icon = 'success', ...rest} = opts;
    const T = S.mixin(
        withSwalZ({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2500,
            timerProgressBar: true,
            ...rest,
        }),
    );
    return T.fire({icon, title: title || text});
};

const handleApiError = async (error, options = {}) => {
    const {
        showDetails = true,
        defaultTitle = 'Error',
        defaultMessage = 'Something went wrong.',
        closeText = 'Close',
    } = options;

    const data = error?.response?.data;
    const rawTitle = data?.title;
    const rawMessage = data?.message ?? data?.error ?? error?.message;

    const titleText = rawTitle ? esc(rawTitle) : defaultTitle;
    const messageText = rawMessage ? esc(rawMessage) : defaultMessage;
    const details = data?.details ?? data?.errors ?? null;

    let html = messageText ? `<p>${messageText}</p>` : '';

    if (showDetails && details) {
        html += '<ul style="text-align:left;margin-top:10px;">';
        if (Array.isArray(details)) {
            for (const d of details) {
                const t = typeof d === 'string' ? d : d?.message || JSON.stringify(d);
                html += `<li>${esc(t)}</li>`;
            }
        } else if (typeof details === 'object') {
            for (const [k, v] of Object.entries(details)) {
                const arr = Array.isArray(v) ? v : [v];
                for (const msg of arr) html += `<li><strong>${esc(k)}:</strong> ${esc(String(msg))}</li>`;
            }
        } else {
            html += `<li>${esc(String(details))}</li>`;
        }
        html += '</ul>';
    }

    return alert({icon: 'error', title: titleText, html, confirmButtonText: closeText});
};

const decide = (opts = {}) => {
    const S = swal();
    const {
        title = 'Confirmation',
        text = '',
        html,
        icon = 'question',

        confirmButtonText = 'Approve',
        denyButtonText = 'Reject',
        cancelButtonText = 'Cancel',

        reasonLabel = 'Reason',
        reasonPlaceholder = 'Enter your reason...',
        reasonValue = '',
        input = 'textarea',

        requireReasonOnConfirm = false,
        requireReasonOnDeny = true,

        showReasonInput = undefined,

        requiredMessageOnConfirm = 'Please enter a reason.',
        requiredMessageOnDeny = 'Please enter a reason to reject.',

        ...rest
    } = opts;

    if (!S) {
        const ok = window.confirm(title || text || 'Confirm?');
        return Promise.resolve({
            isConfirmed: ok,
            isDenied: false,
            isDismissed: !ok,
            reason: '',
            value: ok ? {reason: ''} : undefined,
        });
    }

    const needReasonInput =
        showReasonInput ?? (requireReasonOnConfirm || requireReasonOnDeny);

    const getReason = () => (S.getInput()?.value ?? '').trim();

    const swalOptions = {
        icon,
        title,
        text: html ? undefined : text,
        html,

        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText,
        denyButtonText,
        cancelButtonText,

        focusConfirm: false,
        allowOutsideClick: () => !S.isLoading(),

        preConfirm: () => {
            const reason = needReasonInput ? getReason() : '';
            if (requireReasonOnConfirm && !reason) {
                S.showValidationMessage(requiredMessageOnConfirm);
                return false;
            }
            return {reason};
        },

        preDeny: () => {
            const reason = needReasonInput ? getReason() : '';
            if (requireReasonOnDeny && !reason) {
                S.showValidationMessage(requiredMessageOnDeny);
                return false;
            }
            return {reason};
        },

        ...rest,
    };

    if (needReasonInput) {
        swalOptions.input = input;
        swalOptions.inputLabel = reasonLabel;
        swalOptions.inputPlaceholder = reasonPlaceholder;
        swalOptions.inputValue = reasonValue;
    }

    return S.fire(withSwalZ(swalOptions)).then((res) => {
        const reason = res?.value?.reason ?? '';
        return {...res, reason};
    });
};


const open = (t, o = {}) => _open(t, o);
const openReplace = (t, o = {}) => _open(t, {...o, strategy: 'replace'});
const openStack = (t, o = {}) => _open(t, {...o, strategy: 'stack'});
const openAuto = (t, o = {}) => _open(t, {...o, strategy: 'auto'});

const ModalManager = {
    init,
    destroy,
    open,
    openReplace,
    openStack,
    openAuto,
    close,
    closeTop,
    closeAll,
    isOpen,
    getStack,
    swal: {alert, confirm, toast, handleApiError, decide},
};

export default ModalManager;
export {ModalManager};
