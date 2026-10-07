
        let currentActiveCid = '362';
        let currentTabIndex = 0;
        let bottomDialogInstance = null;

        $(document).ready(function() {
            // Clone articles 2, 3, 4 into #life container
            const art2 = $('article[data-cid="344"]').clone();
            const art3 = $('article[data-cid="319"]').clone();
            const art4 = $('article[data-cid="313"]').clone();
            $('#life .category-posts-container').append(art2).append(art3).append(art4);

            if (window.ViewImage && window.ViewImage.init) {
                window.ViewImage.init('[view-image] img');
            }

            window.addEventListener('resize', () => {
                updateIndicator(currentTabIndex);
            });

            setTimeout(() => {
                updateIndicator(0);
            }, 50);

            const nightCookie = document.cookie.replace(/(?:(?:^|.*;\s*)night\s*\=\s*([^;]*).*$)|^.*$/, "$1");
            if (nightCookie === '1') {
                document.documentElement.classList.add('dark');
            }

            // Router initial run based on current URL path
            navigateTo(window.location.pathname, false);
        });

        // 1. Router & Navigation
        function updateSidebarActive(pageKey) {
            $('.side_menu .nav_menu_btn').removeClass('text-blue-400 border-blue-400 dark:border-blue-400');
            $('#nav-btn-about').removeClass('border-blue-400 dark:border-blue-400');

            if (pageKey === 'about') {
                $('#nav-btn-about').addClass('border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'home' || pageKey === 'post_detail') {
                $('#nav-btn-home').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'archives') {
                $('#nav-btn-archives').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'messages') {
                $('#nav-btn-messages').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'photos') {
                $('#nav-btn-photos').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'circle') {
                $('#nav-btn-circle').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else if (pageKey === 'links') {
                $('#nav-btn-links').addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            }
        }

        function navigateTo(url, push = true) {
            if (push) {
                history.pushState(null, '', url);
            }

            let path = url;
            try {
                const parsed = new URL(url, window.location.origin);
                path = parsed.pathname;
            } catch(e) {}
            
            let normalized = path;
            while (normalized.length > 1 && normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }
            if (!normalized) normalized = '/';

            $('.page-view').addClass('hidden');

            let pageKey = 'home';
            let targetView = $('#view-home');
            let title = '若志 • 随笔';

            if (normalized === '/about') {
                pageKey = 'about';
                targetView = $('#view-about');
                title = '关于 - 若志 • 随笔';
            } else if (normalized === '/archives') {
                pageKey = 'archives';
                targetView = $('#view-archives');
                title = '归档 - 若志 • 随笔';
            } else if (normalized === '/messages') {
                pageKey = 'messages';
                targetView = $('#view-messages');
                title = '留言 - 若志 • 随笔';
            } else if (normalized === '/photos') {
                pageKey = 'photos';
                targetView = $('#view-photos');
                title = '分类 相册 下的文章 - 若志 • 随笔';
            } else if (normalized === '/circle') {
                pageKey = 'circle';
                targetView = $('#view-circle');
                title = '友圈 - 若志 • 随笔';
            } else if (normalized === '/links') {
                pageKey = 'links';
                targetView = $('#view-links');
                title = '友链 - 若志 • 随笔';
            } else if (normalized.startsWith('/archives/') || (normalized.startsWith('/archives') && normalized !== '/archives')) {
                pageKey = 'post_detail';
                targetView = $('#view-post_detail');
                title = '随笔#“豆包AI手机” - 若志 • 随笔';
            } else if (normalized === '/lifes' || normalized === '/study-notes' || normalized === '/blog-notes' || normalized === '/do-notes') {
                pageKey = 'home';
                targetView = $('#view-home');
                title = '若志 • 随笔';
                const midMap = { '/lifes': 1, '/study-notes': 2, '/blog-notes': 3, '/do-notes': 4 };
                setTimeout(() => switchCategoryTab(midMap[normalized] || 0), 50);
            } else {
                pageKey = 'home';
                targetView = $('#view-home');
                title = '若志 • 随笔';
            }

            document.title = title;
            targetView.removeClass('hidden');
            updateSidebarActive(pageKey);

            toggleMobileNav(false);
            targetView.find('.page_content').scrollTop(0);
            $(window).scrollTop(0);

            if (window.ViewImage && window.ViewImage.init) {
                window.ViewImage.init('[view-image] img');
            }

            if (pageKey === 'home') {
                setTimeout(() => updateIndicator(currentTabIndex), 50);
            }
        }

        window.addEventListener('popstate', function() {
            navigateTo(window.location.pathname, false);
        });

        function navigateToCategory(mid) {
            navigateTo('/');
            setTimeout(() => {
                switchCategoryTab(mid);
            }, 100);
        }

        $(document).on('click', '.article-contents, .post-item b', function(e) {
            if (!$(e.target).closest('a[target="_blank"]').length && !$(e.target).closest('img').length && !$(e.target).closest('.post-suport, .showBottomAction').length) {
                navigateTo('/archives/362/');
            }
        });

        // 2. Dark Mode Toggle
        function switchNightMode() {
            const isDark = document.documentElement.classList.contains('dark');
            let mToast = new QToast();
            mToast.setTime(1500);

            if (isDark) {
                document.documentElement.classList.remove('dark');
                document.cookie = "night=0;path=/";
                mToast.setMessage('夜间模式关闭');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            } else {
                document.documentElement.classList.add('dark');
                document.cookie = "night=1;path=/";
                mToast.setMessage('夜间模式开启');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            }
            mToast.show();
        }

        // 3. Category Tab Switching with Animated Underline
        function switchCategoryTab(index) {
            currentTabIndex = index;
            $('.pagetab_menu .page_tab_common').removeClass('page_tab_active');
            $('.pagetab_menu .page_tab_common').eq(index).addClass('page_tab_active');
            updateIndicator(index);
            $('.page_tab_content').css('left', `-${index * 100}%`);
        }

        function updateIndicator(index) {
            const tabItems = document.querySelectorAll('.pagetab_menu .page_tab_common');
            const line = document.querySelector('.tab__line');
            if (tabItems[index] && line) {
                const target = tabItems[index];
                line.style.left = target.offsetLeft + 'px';
                line.style.width = target.offsetWidth + 'px';
            }
        }

        // 4. BottomActionDialog (Home Comment Drawer)
        const mockCommentData = {
            '362': [
                { author: '小明', date: '5 天前', ip: '广东深圳', text: '确实，智谱的API有调用频次限制，本地跑的话显存至少要16G起步！不过手机ADB控制确实好玩~' },
                { author: 'Geek_Dev', date: '4 天前', ip: '上海', text: '蹲一个详细的折腾教程！AutoGLM对于UI点击的识别率目前能达到多少？(・ω・)' },
                { author: '若志', date: '3 天前', ip: '浙江杭州', text: '回复 @Geek_Dev ：识别常规app界面还行，遇到弹窗有时会卡壳，后面有空我整理篇详细的博文~' },
                { author: 'CyberGhost', date: '2 天前', ip: '北京', text: '科技改变生活啊，期待开源社区做出更轻量的端侧模型！(๑•̀ㅂ•́)و✧' }
            ],
            '344': [
                { author: '山野微风', date: '20 天前', ip: '四川成都', text: '热爱生活的人永远年轻！九宫格拼图很有仪式感 👏' },
                { author: '骑行客', date: '18 天前', ip: '云南昆明', text: '第二张骑行冲顶的照片太帅了！这是在哪条路线？' }
            ],
            '319': [
                { author: '火锅达人', date: '2 个月前', ip: '重庆', text: '重庆欢迎你！龙兴球场确实远，黄牛票千万不能信，现在全是大麦强实名了。夜景洪崖洞和千厮门大桥拍得很美！' }
            ],
            '313': [
                { author: '江南客', date: '2 个月前', ip: '浙江杭州', text: '“人生不过三万天，自由一天是一天”，很有感触。滨江区的樱花和西湖的冬日很有韵味。' }
            ],
            '301': [
                { author: '老朋友', date: '3 个月前', ip: '江苏南京', text: '哈哈哈哈，我也刚回访了一圈，看到大家还在写博客真的很感动！友链常在！(｡･ω･｡)' }
            ]
        };

        function openCommentDrawer(cid, initialCount) {
            currentActiveCid = cid;
            $('#comment-count-display').text(initialCount);
            renderComments(cid);

            if (!bottomDialogInstance) {
                bottomDialogInstance = new QBottomActionDialog('#BottomActionDialog');
                bottomDialogInstance.setCanceledonScrollOutside(true);
                bottomDialogInstance.setCancelButtonOnClick(() => {
                    closeCommentDrawer();
                });
            }
            bottomDialogInstance.show();
        }

        function closeCommentDrawer() {
            if (bottomDialogInstance) {
                bottomDialogInstance.close();
            }
            $('.emoji-icons').slideUp();
            $('.user-info-body').slideUp();
        }

        function renderComments(cid) {
            const list = mockCommentData[cid] || [];
            const container = $('#BottomActionDialog .comments-list');
            container.empty();

            if (list.length === 0) {
                $('.comments-null').removeClass('hidden');
            } else {
                $('.comments-null').addClass('hidden');
                list.forEach(c => {
                    const itemHtml = `
                        <div class="messages flex gap-3 text-sm border-b dark:border-slate-700/60 pb-3">
                            <div class="avatar rounded border dark:border-slate-700 w-8 h-8 flex-shrink-0 overflow-hidden">
                                <img class="rounded w-full h-full object-cover" src="assets/img/avatar_comment.png" alt="${c.author}">
                            </div>
                            <div class="content flex-1">
                                <div class="content-info flex items-center gap-2 mb-1">
                                    <span class="name font-medium text-slate-700 dark:text-slate-300 text-xs">${c.author}</span>
                                    <small class="messages-time text-gray-400 dark:text-gray-500 text-xs">${c.date}</small>
                                    <small class="messages-ip text-gray-400 dark:text-gray-500 text-xs">[${c.ip || '中国'}]</small>
                                </div>
                                <div class="contents rounded-md bg-gray-50 dark:bg-slate-700/70 p-2.5 text-xs text-slate-600 dark:text-slate-300">
                                    <div class="text break-all">${c.text}</div>
                                </div>
                            </div>
                        </div>
                    `;
                    container.append(itemHtml);
                });
            }
        }

        function submitComment() {
            const text = $('#message-textarea').val().trim();
            if (!text) {
                let mToast = new QToast();
                mToast.setMessage('请输入评论内容');
                mToast.setType(mToast.TOAST_TYPE_WARNING);
                mToast.setTime(1500);
                mToast.show();
                return;
            }

            const author = $('#author').val().trim() || '热心网友';
            const newComment = {
                author: author,
                date: '刚刚',
                ip: '本地访客',
                text: text
            };

            if (!mockCommentData[currentActiveCid]) {
                mockCommentData[currentActiveCid] = [];
            }
            mockCommentData[currentActiveCid].push(newComment);

            renderComments(currentActiveCid);

            const countSpan = $(`article[data-cid="${currentActiveCid}"] .comment-num`);
            const curVal = parseInt(countSpan.text() || '0', 10) + 1;
            countSpan.text(curVal);
            $('#comment-count-display').text(curVal);

            $('#message-textarea').val('');

            let mToast = new QToast();
            mToast.setMessage('评论发送成功！');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1500);
            mToast.show();

            const panel = $('.qui-bottom-action-panel');
            panel.animate({ scrollTop: panel[0].scrollHeight }, 300);
        }

        function toggleEmojiPanel() {
            $('.emoji-icons').slideToggle();
            $('#emoji-icons-btn').toggleClass('border text-blue-400');
        }

        function switchEmojiTab(type) {
            $('.emoji-tab-btn').removeClass('active text-blue-400 font-bold');
            if (type === 'emoji') {
                $('.emoji-tab-btn:first').addClass('active text-blue-400 font-bold');
                $('#emoji-pane-standard').removeClass('hidden');
                $('#emoji-pane-owo').addClass('hidden');
            } else {
                $('.emoji-tab-btn:last').addClass('active text-blue-400 font-bold');
                $('#emoji-pane-standard').addClass('hidden');
                $('#emoji-pane-owo').removeClass('hidden');
            }
        }

        function insertEmoji(char) {
            const textarea = document.getElementById('message-textarea');
            if (textarea) {
                textarea.value += char;
                textarea.focus();
            }
        }

        function toggleUserInfo() {
            $('.user-info-body').slideToggle();
        }

        function insertMarkdownLink() {
            const textarea = document.getElementById('message-textarea');
            if (textarea) {
                textarea.value += '[链接描述](https://)';
                textarea.focus();
            }
        }

        function togglePrivateComment() {
            const checkbox = document.getElementById('secret-button2');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                if (checkbox.checked) {
                    $('#private-icon-line').addClass('hidden');
                    $('#private-icon-fill').removeClass('hidden');
                } else {
                    $('#private-icon-line').removeClass('hidden');
                    $('#private-icon-fill').addClass('hidden');
                }
            }
        }

        function autoResize(el) {
            el.style.height = 'auto';
            el.style.height = (el.scrollHeight) + 'px';
        }

        // 5. Feed Likes
        function handleLike(el) {
            const $el = $(el);
            const icon = $el.find('i');
            const numSpan = $el.find('.like-num');
            let count = parseInt(numSpan.text() || '0', 10);

            if (icon.hasClass('ri-heart-line')) {
                icon.removeClass('ri-heart-line').addClass('ri-heart-fill text-red-500');
                numSpan.text(count + 1);
                numSpan.addClass('text-red-500');

                let mToast = new QToast();
                mToast.setMessage('点赞成功 +1');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                mToast.setTime(1500);
                mToast.show();
            } else {
                icon.removeClass('ri-heart-fill text-red-500').addClass('ri-heart-line');
                numSpan.text(Math.max(0, count - 1));
                numSpan.removeClass('text-red-500');
            }
        }

        // 6. Post Detail (/archives/362/)
        function handleDetailLike(el) {
            const $el = $(el);
            const icon = $el.find('i');
            const numSpan = $el.find('.detail-like-num');
            let count = parseInt(numSpan.text() || '53', 10);

            if (icon.hasClass('ri-heart-line')) {
                icon.removeClass('ri-heart-line').addClass('ri-heart-fill text-red-500');
                numSpan.text(count + 1);
                numSpan.addClass('text-red-500');

                let mToast = new QToast();
                mToast.setMessage('点赞成功 +1');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                mToast.setTime(1500);
                mToast.show();
            } else {
                icon.removeClass('ri-heart-fill text-red-500').addClass('ri-heart-line');
                numSpan.text(Math.max(0, count - 1));
                numSpan.removeClass('text-red-500');
            }
        }

        function submitDetailComment() {
            const text = $('#detail-textarea').val().trim();
            if (!text) {
                let mToast = new QToast();
                mToast.setMessage('请输入评论内容');
                mToast.setType(mToast.TOAST_TYPE_WARNING);
                mToast.setTime(1500);
                mToast.show();
                return;
            }

            const author = $('#detail-author').val().trim() || '热心网友';
            const newCommentHtml = `
                <li class="messages messages-l Comments-by-user comment-parent comment-odd depth-1">
                    <div class="avatar rounded border dark:border-slate-700 relative">
                        <img class="rounded" src="assets/img/avatar_comment.png" alt="${author}" width="32" height="32">
                        <div class="messages-at w-full h-full absolute left-0 top-0 flex justify-center items-center bg-gray-50 dark:bg-slate-700 cursor-pointer">@</div>
                    </div>
                    <div class="content">
                        <div class="flex items-center mb-1 gap-1 name content-info">
                            <b>${author}</b>
                            <div class="messages-time text-gray-400 dark:text-gray-500">刚刚</div>
                        </div>
                        <div class="contents rounded-md shadow-sm bg-gray-50 dark:bg-slate-700" view-image="">
                            <div class="text break-all">
                                <p>${text}</p>
                            </div>
                        </div>
                    </div>
                </li>
            `;

            $('#detail-comments-list').prepend(newCommentHtml);

            const badge = $('.detail-comments-count-badge');
            const curVal = parseInt(badge.text() || '30', 10) + 1;
            badge.text(curVal);

            $('#detail-textarea').val('');

            let mToast = new QToast();
            mToast.setMessage('评论发表成功！');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1500);
            mToast.show();
        }

        function toggleDetailUserInfo() {
            $('.detail-user-info-body').slideToggle();
        }

        function toggleDetailEmojiPanel() {
            $('#detail-emoji-panel').slideToggle();
        }

        function switchDetailEmojiTab(type) {
            if (type === 'emoji') {
                $('#detail-emoji-pane-std').removeClass('hidden');
                $('#detail-emoji-pane-owo').addClass('hidden');
                $('.detail-emoji-tab-std').addClass('active font-bold text-blue-400');
                $('.detail-emoji-tab-owo').removeClass('active font-bold text-blue-400');
            } else {
                $('#detail-emoji-pane-std').addClass('hidden');
                $('#detail-emoji-pane-owo').removeClass('hidden');
                $('.detail-emoji-tab-std').removeClass('active font-bold text-blue-400');
                $('.detail-emoji-tab-owo').addClass('active font-bold text-blue-400');
            }
        }

        function insertDetailEmoji(char) {
            const textarea = document.getElementById('detail-textarea');
            if (textarea) {
                textarea.value += char;
                textarea.focus();
            }
        }

        function insertDetailMarkdownLink() {
            const textarea = document.getElementById('detail-textarea');
            if (textarea) {
                textarea.value += '[链接描述](https://)';
                textarea.focus();
            }
        }

        function toggleDetailPrivateComment() {
            let mToast = new QToast();
            mToast.setMessage('私密评论功能已切换');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1200);
            mToast.show();
        }

        // 7. Messages / Guestbook (/messages)
        function toggleMsgUserInfo() {
            $('.msg-user-info-body').slideToggle();
        }

        function toggleMsgEmojiPanel() {
            $('#msg-emoji-panel').slideToggle();
        }

        function switchMsgEmojiTab(type) {
            if (type === 'emoji') {
                $('#msg-emoji-pane-std').removeClass('hidden');
                $('#msg-emoji-pane-owo').addClass('hidden');
                $('.msg-emoji-tab-std').addClass('active font-bold text-blue-400');
                $('.msg-emoji-tab-owo').removeClass('active font-bold text-blue-400');
            } else {
                $('#msg-emoji-pane-std').addClass('hidden');
                $('#msg-emoji-pane-owo').removeClass('hidden');
                $('.msg-emoji-tab-std').removeClass('active font-bold text-blue-400');
                $('.msg-emoji-tab-owo').addClass('active font-bold text-blue-400');
            }
        }

        function insertMsgEmoji(char) {
            const textarea = document.getElementById('msg-textarea');
            if (textarea) {
                textarea.value += char;
                textarea.focus();
            }
        }

        function insertMsgMarkdownLink() {
            const textarea = document.getElementById('msg-textarea');
            if (textarea) {
                textarea.value += '[链接描述](https://)';
                textarea.focus();
            }
        }

        function toggleMsgPrivateComment() {
            let mToast = new QToast();
            mToast.setMessage('私密留言已开启');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1200);
            mToast.show();
        }

        function submitGuestbookMessage() {
            const text = $('#msg-textarea').val().trim();
            if (!text) {
                let mToast = new QToast();
                mToast.setMessage('请输入留言内容');
                mToast.setType(mToast.TOAST_TYPE_WARNING);
                mToast.setTime(1500);
                mToast.show();
                return;
            }

            const author = $('#msg-author').val().trim() || '热心网友';
            const newMsgHtml = `
                <li class="messages messages-l Comments-by-user comment-parent comment-odd depth-1 animate-fade-in">
                    <div class="avatar rounded border dark:border-slate-700 relative">
                        <img class="rounded" src="assets/img/avatar_comment.png" alt="${author}" width="32" height="32">
                        <div class="messages-at w-full h-full absolute left-0 top-0 flex justify-center items-center bg-gray-50 dark:bg-slate-700 cursor-pointer">@</div>
                    </div>
                    <div class="content">
                        <div class="flex items-center mb-1 gap-1 name content-info">
                            <b>${author}</b>
                            <div class="messages-time text-gray-400 dark:text-gray-500">刚刚</div>
                        </div>
                        <div class="contents rounded-md shadow-sm bg-gray-50 dark:bg-slate-700" view-image="">
                            <div class="text break-all">
                                <p>${text}</p>
                            </div>
                        </div>
                    </div>
                </li>
            `;

            $('#messages-comment-list').prepend(newMsgHtml);

            const badge = $('#messages-count-badge');
            const curVal = parseInt(badge.text() || '823', 10) + 1;
            badge.text(curVal);

            $('#msg-textarea').val('');

            let mToast = new QToast();
            mToast.setMessage('留言发送成功！');
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1500);
            mToast.show();
        }

        // 8. Search
        function filterPosts(keyword) {
            const query = (keyword || '').trim().toLowerCase();
            const activeTabPane = $('.page_tab_body').eq(currentTabIndex);
            const articles = activeTabPane.find('.post-item');

            articles.each(function() {
                const text = $(this).text().toLowerCase();
                if (!query || text.includes(query)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        }

        function triggerSearch() {
            const val = $('#search').val();
            let mLoadingTip = new QLoadingTip();
            mLoadingTip.setMessage('正在检索文章...');
            mLoadingTip.setTime(800);
            mLoadingTip.show();

            if ($('#view-home').hasClass('hidden')) {
                navigateTo('/');
            }
            filterPosts(val);
        }

        // 9. Login Modal
        function toggleLoginModal(show) {
            if (show) {
                $('#Login').addClass('qui-page-show');
            } else {
                $('#Login').removeClass('qui-page-show');
            }
        }

        function submitLogin() {
            const name = $('#login_name').val().trim();
            toggleLoginModal(false);
            let mToast = new QToast();
            mToast.setMessage('登录成功，欢迎：' + (name || '若志'));
            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
            mToast.setTime(1500);
            mToast.show();
        }

        // 10. Mobile Menu
        function toggleMobileNav(open) {
            if (open) {
                $('body').addClass('nav-open');
            } else {
                $('body').removeClass('nav-open');
            }
        }

        // 11. Scroll
        function handleScroll(el) {
            if (el.scrollTop > 100) {
                $('#GoTop').removeClass('hidden');
            } else {
                $('#GoTop').addClass('hidden');
            }
        }

        function scrollToTop() {
            $('.page_content').animate({ scrollTop: 0 }, 300);
            $(window).scrollTop(0);
        }

        function triggerLoadMore(el) {
            const $btn = $(el);
            $btn.text('正在加载中...');
            setTimeout(() => {
                $btn.text('已加载全部内容');
                let mToast = new QToast();
                mToast.setMessage('已加载全部动态');
                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                mToast.setTime(1500);
                mToast.show();
            }, 600);
        }
    