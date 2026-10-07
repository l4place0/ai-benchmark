console.log("\n %c Theme %c A-Sleek \n\n", "color: #eee; background: #222f3e; padding:5px 0;", "background: #989898; padding:5px 0;");

/* 切换夜间模式 */
function switchNightMode() {
    var night = document.cookie.replace(/(?:(?:^|.*;\s*)night\s*\=\s*([^;]*).*$)|^.*$/, "$1") || "0";

    if (night == "0") {
        document.documentElement.classList.add("dark");
        $(".markdown-body").attr("data-theme", "dark");
        document.cookie = "night=1;path=/";
        console.log("夜间模式开启")

        let mToast = new QToast();
        mToast.setMessage('夜间模式开启');
        mToast.setType(mToast.TOAST_TYPE_SUCCESS);
        mToast.setTime(1500);
        mToast.show();

    } else {
        document.documentElement.classList.remove("dark");
        $(".markdown-body").attr("data-theme", "light");
        document.cookie = "night=0;path=/";
        console.log("夜间模式关闭")

        let mToast = new QToast();
        mToast.setMessage('夜间模式关闭');
        mToast.setType(mToast.TOAST_TYPE_WARNING);
        mToast.setTime(1500);
        mToast.show();
    }
} (function () {
    if (document.cookie.replace(/(?:(?:^|.*;\s*)night\s*\=\s*([^;]*).*$)|^.*$/, "$1") === "") {
        if (new Date().getHours() > 21 || new Date().getHours() < 6) {
            document.documentElement.classList.add("dark");
            $(".markdown-body").attr("data-theme", "dark");
            document.cookie = "night=1;path=/";
            console.log("夜间模式开启")
        } else {
            document.documentElement.classList.remove("dark");
            $(".markdown-body").attr("data-theme", "light");
            document.cookie = "night=0;path=/";
            console.log("夜间模式关闭")
        }
    } else {
        var night = document.cookie.replace(/(?:(?:^|.*;\s*)night\s*\=\s*([^;]*).*$)|^.*$/, "$1") || "0";
        if (night == "0") {
            document.documentElement.classList.remove("dark")
            $(".markdown-body").attr("data-theme", "light");
        } else if (night == "1") {
            document.documentElement.classList.add("dark")
            $(".markdown-body").attr("data-theme", "dark");
        }
    }
})();

function setCookie(name, value) {
    document.cookie = name + "=" + encodeURIComponent(value) + "; path=/";
}
function getCookie(name) {
    var cookieArr = document.cookie.split(';');
    for (var i = 0; i < cookieArr.length; i++) {
        var cookiePair = cookieArr[i].split('=');
        var cookieName = cookiePair[0].trim();
        if (cookieName === name) {
            return decodeURIComponent(cookiePair[1]);
        }
    }
    return "";
}
function deleteCookie(name, domain, path) {
    const expireTime = new Date();
    expireTime.setSeconds(expireTime.getSeconds() - 1);
    const cookieString = `${name}=; expires=${expireTime.toUTCString()}; path=${path}; domain=${domain}`;
    document.cookie = cookieString;
}

function formatTime(timestamp) {
    const currentTime = Math.floor(Date.now() / 1000); // 当前时间戳
    const seconds = currentTime - timestamp; // 时间差（秒）

    const interval = {
        年: 31536000,
        月: 2592000,
        周: 604800,
        天: 86400,
        小时: 3600,
        分钟: 60,
        秒: 1
    };

    for (const [unit, secondsInUnit] of Object.entries(interval)) {
        const count = Math.floor(seconds / secondsInUnit);
        if (count >= 1) {
            if (unit === '月') {
                const date = new Date(timestamp * 1000);
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const day = date.getDate();
                const hours = date.getHours();
                const minutes = date.getMinutes();
                return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day} ${hours < 10 ? '0' + hours : hours}:${minutes < 10 ? '0' + minutes : minutes}`;
            } else {
                return count + " " + unit + "前";
            }
        }
    }

    return "刚刚";
}
/** comment create && cancel */
function createReply(coid, author) {
    $('.comment-form').addClass('Comments_publisher');
    var coid;
    var author;
    $('.reply-comment-parent').remove();
    $('.Comments_publisher').append('<input type="hidden" name="parent" id="comment-parent" class="reply-comment-parent" value="' + coid + '">');
    $('.Comments_publisher textarea').attr('placeholder', '正在回复：' + author);
    $('.cancelReply').html("<span class='flex items-center justify-center px-3 pb-2 rounded-b'>@" + author + "<i class='ri-close-line'>").css('display', 'inline-block');
    $('.Comments_publisher textarea').focus();
    let mToast = new QToast();
    mToast.setMessage('正在回复:' + author);
    mToast.setType(mToast.TOAST_TYPE_INFO);
    mToast.setTime(2000);
    mToast.show();
}

function cancelReply() {
    $('.reply-comment-parent').remove();
    $('.cancelReply').text('').css('display', 'none');
    $('.Comments_publisher textarea').attr('placeholder', '来都来了，说点什么呗~');
    let mToast = new QToast();
    mToast.setMessage('已取消回复');
    mToast.setType(mToast.TOAST_TYPE_INFO);
    mToast.setTime(2000);
    mToast.show();
}

function autoResize(textarea) {
    textarea.style.height = 'auto'; // 先将高度设置为auto，以便重新计算高度
    textarea.style.height = textarea.scrollHeight + 'px'; // 设置文本框的高度为内容的高度
}
var isAJAXExecuted = false;
var isAJAXExecuted2 = false;

const Sleek = {
    GoTop: function () {
        $("#GoTop").click(function () {
            var _this = $(this);
            $('.page_content').animate({ scrollTop: 0 }, 500);
        });
        $('.page_content').on("scroll", function () {
            var fromTop = $('.page_content').scrollTop();
            if (fromTop > 100) {  //判断滚动后高度超过200px,就显示
                $('#GoTop').removeClass('hidden');
            } else {
                $('#GoTop').addClass('hidden');
            }
        });
    },
    lazyload: function () {
        lazySizes.init();
    },
    ViewImage: function () {
        window.ViewImage && ViewImage.init();
    },
    menu_tab: function () {
        let prevContentIndex = 0;
        let items = document.querySelectorAll('.page_tab_common');
        let line = document.querySelector('.tab__line');
        let activeContentIndex = 0;
        function updateLinePosition(index) {
            activeContentIndex = index;
            let leftOffset = items[index].offsetLeft;
            line.style.left = leftOffset + 'px';
            line.style.transition = "all 0.3s";
        }
        function updateLineByIndex(index) {
            let leftOffset = items[index].offsetLeft;
            line.style.left = leftOffset + 'px';
            line.style.transition = "all 0.3s";
        }
        items.forEach((item, index) => {
            item.addEventListener('click', function () {
                updateLinePosition(index);
                prevContentIndex = index;
            });

            item.addEventListener('mouseenter', function () {
                line.style.left = items[index].offsetLeft + 'px';
                line.style.transition = "all 0.3s";
            });

            item.addEventListener('mouseleave', function () {
                line.style.left = items[activeContentIndex].offsetLeft + 'px';
                line.style.transition = "all 0.3s";
            });
        });
        if ($('.page_tab_content')[0]) {
            $('.page_tab_content')[0].style.left = "0%";
        }

        // 为分类标签页绑定"加载更多"事件
        function bindCategoryLoadMore($container, mid) {
            $container.off('click', '.page_next .next').on('click', '.page_next .next', function (e) {
                e.preventDefault();
                var $this = $(this);
                var href = $this.attr('href');

                if (!href || href === 'undefined') return;

                $this.addClass('loading').text('正在加载中...');

                $.ajax({
                    url: href,
                    type: 'get',
                    dataType: 'json',
                    error: function () {
                        $this.removeClass('loading').text('加载更多');
                        let mToast = new QToast();
                        mToast.setMessage('加载失败');
                        mToast.setType(mToast.TOAST_TYPE_WARNING);
                        mToast.setTime(1500);
                        mToast.show();
                    },
                    success: function (res) {
                        if (res.success) {
                            $this.removeClass('loading').text('加载更多');

                            // 解析返回的HTML，提取文章列表
                            var $newPosts = $(res.html).filter('.post-item');

                            // 插入到page_next之前
                            $newPosts.insertBefore($container.find('.page_next'));

                            // 滚动到新加载的第一篇文章
                            var targetPost = $container.find('.post-item:nth-last-child(' + (res.count + 1) + ')');
                            if (targetPost.length) {
                                var offset = $container.scrollTop() + targetPost.offset().top - $container.offset().top - 100;
                                $container.animate({
                                    scrollTop: offset
                                }, {
                                    duration: 600,
                                    easing: "linear"
                                });
                            }

                            // 重新初始化功能
                            Sleek.lazyload();
                            Sleek.ViewImage();
                            Sleek.get_post_support();
                            Sleek.postItems();

                            // 更新下一页链接
                            var $newPageNext = $(res.html).filter('.page_next');
                            if ($newPageNext.length) {
                                var newHref = $newPageNext.find('.next').attr('href');
                                if (newHref && newHref !== 'undefined') {
                                    $container.find('.page_next .next').attr('href', newHref);
                                    let mToast = new QToast();
                                    mToast.setMessage('加载成功');
                                    mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                                    mToast.setTime(1500);
                                    mToast.show();
                                } else {
                                    // 没有下一页了
                                    $container.find('.page_next').html('<span class="py-3 text-sm text-gray-400 dark:text-gray-500">我也是有底线的~</span>');
                                    let mToast = new QToast();
                                    mToast.setMessage('最后一页咕~');
                                    mToast.setType(mToast.TOAST_TYPE_INFO);
                                    mToast.setTime(1500);
                                    mToast.show();
                                }
                            }
                        }
                    }
                });
            });
        }

        // 提取懒加载逻辑为独立函数
        function loadCategoryContent(index) {
            var $targetTab = $('.pagetab_menu .page_tab_common').eq(index);
            var mid = $targetTab.data('mid');

            // AJAX 懒加载逻辑
            if (mid && mid > 0) {
                var $contentTab = $('.page_tab_body[data-mid="' + mid + '"]');
                var isLoaded = $contentTab.attr('data-loaded') === 'true';

                // 如果未加载过，则发起 AJAX 请求
                if (!isLoaded) {
                    $.ajax({
                        url: '/?action=loadCategoryPosts',
                        type: 'GET',
                        data: { mid: mid },
                        dataType: 'json',
                        beforeSend: function () {
                            $contentTab.find('.loading-placeholder span').text('加载中...');
                        },
                        success: function (res) {
                            if (res.success) {
                                $contentTab.html(res.html);
                                $contentTab.attr('data-loaded', 'true');

                                Sleek.lazyload();
                                Sleek.ViewImage();
                                Sleek.get_post_support();
                                Sleek.postItems();

                                // 为分类标签页的"加载更多"按钮绑定事件
                                bindCategoryLoadMore($contentTab, mid);

                                let mToast = new QToast();
                                mToast.setMessage('加载成功');
                                mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                                mToast.setTime(1000);
                                mToast.show();
                            } else {
                                $contentTab.find('.loading-placeholder span').text('加载失败，请重试');
                            }
                        },
                        error: function () {
                            $contentTab.find('.loading-placeholder span').text('加载失败，请重试');
                            let mToast = new QToast();
                            mToast.setMessage('加载失败');
                            mToast.setType(mToast.TOAST_TYPE_WARNING);
                            mToast.setTime(1500);
                            mToast.show();
                        }
                    });
                }
            }
        }
        $('.pagetab_menu').on('click', '.page_tab_common', function () {
            var index = $(this).index();

            $('.page_tab_content').css('left', '-' + index * 100 + '%');
            $('.pagetab_menu .page_tab_common').eq(index).addClass('page_tab_active').siblings().removeClass('page_tab_active');
            updateLinePosition(index);

            // 调用懒加载函数
            loadCategoryContent(index);
        });
        let startX = 0;
        let disX = 0;
        $('.page_tab_content').on('touchstart', '.page_tab_body', function (e) {
            startX = e.originalEvent.changedTouches[0].clientX;
        });
        $('.page_tab_content').on('touchmove', '.page_tab_body', function (e) {
            e.stopPropagation();
        });
        $('.page_tab_content').on('touchend', '.page_tab_body', function (e) {
            disX = e.originalEvent.changedTouches[0].clientX - startX;
            var leftNum = parseInt($('.page_tab_content')[0].style.left);
            if (disX > 0 && disX >= 100) { // 向右滑动
                if (leftNum <= -100) {
                    $('.page_tab_content')[0].style.left = leftNum + 100 + "%";
                    var order = -parseInt($('.page_tab_content')[0].style.left) / 100;
                    $('.pagetab_menu .page_tab_common').eq(order).addClass('page_tab_active').siblings().removeClass('page_tab_active');
                    updateLineByIndex(order);
                    // 触发懒加载
                    loadCategoryContent(order);
                }
            } else if (disX < 0 && disX < -100) { // 向左滑动
                if (leftNum >= -300) {
                    $('.page_tab_content')[0].style.left = leftNum - 100 + "%";
                    var order = (-parseInt($('.page_tab_content')[0].style.left)) / 100;
                    $('.pagetab_menu .page_tab_common').eq(order).addClass('page_tab_active').siblings().removeClass('page_tab_active');
                    updateLineByIndex(order);
                    // 触发懒加载
                    loadCategoryContent(order);
                }
            }
        });
    },
    menu_active: function () {
        /* var url = location.href;
        var urlstatus = false;
        $(".side_menu a").each(function () {
            if ((url + '/').indexOf($(this).attr('href')) > -1 && $(this).attr('href') != '/') {
                $(this).addClass('text-blue-400 border-blue-400');
                urlstatus = true; 
            } else { //如果url中不包含当前页面的链接
                $(this).removeClass('text-blue-400 border-blue-400');
            }
        });
        if (!urlstatus) { 
            $(".side_menu a").eq(0).addClass('text-blue-400 border-blue-400');
        } */
        var url = location.href;
        var currentFileName = url.substring(url.lastIndexOf('/') + 1);
        var menuLinks = $(".nav_menu a");

        for (var i = 0; i < menuLinks.length; i++) {
            var link = $(menuLinks[i]).attr('href');
            var linkFileName = link.substring(link.lastIndexOf('/') + 1);

            if (currentFileName === linkFileName) {
                $(menuLinks[i]).addClass('text-blue-400 border-blue-400 dark:border-blue-400');
            } else {
                $(menuLinks[i]).removeClass('text-blue-400 border-blue-400 dark:border-blue-400');
            }
        }

    },
    get_post_support: function () {
        //点赞
        $('.post-suport').on('click', function () {
            let cid = $(this).data('cid');
            $.ajax({
                url: `/?action=support`,
                type: 'POST',
                data: {
                    cid: cid
                },
                dataType: 'json',
                success: res => {
                    if (res.success) {
                        $(this).html('<span class="flex items-center gap-2"><i class="ri-heart-fill text-red"></i><small>' + res.count + '</small></span>')
                        let mToast = new QToast();
                        mToast.setMessage('点赞成功');
                        mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                        mToast.setTime(1500);
                        mToast.show();
                    } else {
                        let mToast = new QToast();
                        mToast.setMessage('明天再赞吧~');
                        mToast.setType(mToast.TOAST_TYPE_INFO);
                        mToast.setTime(1500);
                        mToast.show();
                    }
                }
            });
        });
    },
    load_readmore: function () {
        var max = 150;
        var moretext = '...更多';
        var lesstext = '收起';
        var data = $(".post-excerpt").find('.article-contents');

        // 辅助函数：从HTML中提取纯文本并排除无关标签内容
        function extractText(html) {
            if (!html) return '';

            // 创建临时DOM节点
            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // 移除无关标签
            var tagsToRemove = ['script', 'style', 'noscript', 'iframe', 'img'];
            tagsToRemove.forEach(function (tag) {
                var elements = tempDiv.querySelectorAll(tag);
                elements.forEach(function (el) {
                    el.parentNode.removeChild(el);
                });
            });

            // 获取纯文本并去除首尾空白
            var text = tempDiv.textContent || tempDiv.innerText || '';
            return text.trim();
        }

        $.each(data, function (index, value) {
            var t = $(this);
            var str = t.html();

            // 提取纯文本内容
            var plainText = extractText(str);

            // 获取纯文本内容长度（跳过空白字符）
            var textLength = plainText.replace(/\s/g, '').length;

            if (textLength > max) {
                // 截取时保留HTML结构，从原始HTML中截取
                var excerpt = str.substring(0, max);
                var secdHalf = str.substring(max, str.length);
                var strtoadd = "<span>" + excerpt + "</span><div class='rm_hidden' style='display: none;'>" + secdHalf + "</div><a class='show-more-btn cursor-pointer text-blue-400'  title='Click to Show More'>" + moretext + "</a><a class='read-less-btn cursor-pointer text-blue-400' title='Click to Show Less' style='display: none;'>↑" + lesstext + "</a>";
                $(this).html(strtoadd);
            }

            /* console.log(plainText); 
            console.log(textLength);  */
        });

        // 阅读更多按钮
        $(document).on('click', 'a.show-more-btn', function () {
            var t = $(this);
            t.prev().show();
            t.next().show();
            t.siblings('.rm_hidden').addClass("inline");
            t.siblings('.rm_hidden').prev().addClass("inline");
            t.hide();
        });

        $(document).on('click', 'a.read-less-btn', function () {
            var t = $(this);
            t.siblings('.rm_hidden').hide();
            t.siblings('.dotd').show();
            t.prev().show();
            t.hide();
        });
    },
    page_next: function () {
        //点击下一页的链接(即那个a标签)
        $('.page_next .next').click(function () {
            $this = $(this);
            $this.addClass('loading').text('正在加载中...'); //给a标签加载一个loading的class属性，用来添加加载效果
            var href = $this.attr('href'); //获取下一页的链接地址
            if (href != undefined) { //如果地址存在
                $.ajax({ //发起ajax请求
                    url: href,
                    //请求的地址就是下一页的链接
                    type: 'get',
                    //请求类型是get
                    error: function (request) {
                        //如果发生错误怎么处理
                        let mToast = new QToast();
                        mToast.setMessage('加载失败');
                        mToast.setType(mToast.TOAST_TYPE_WARNING);
                        mToast.setTime(1500);
                        mToast.show();
                    },
                    success: function (data) { //请求成功
                        $this.removeClass('loading').text('加载更多'); //移除loading属性
                        var $res = $(data).find('#post_all .post-item'); //从数据中挑出文章数据，请根据实际情况更改

                        $res.insertBefore('.page_next'); //将数据加载在.page_next的前面

                        var commentContainer = $(".page_tab_body"); // 滚动容器
                        var targetComment = $('#post_all .post-item:nth-last-child(' + Config.pageSize + ')'); // 目标元素

                        // 计算目标评论相对于滚动容器的偏移量
                        var offset = commentContainer.scrollTop() + targetComment.offset().top - commentContainer.offset().top - 100;
                        $(".page_tab_body,.page_content").animate({
                            scrollTop: offset
                        }, {
                            duration: 600,
                            easing: "linear"
                        });

                        Sleek.load_readmore();

                        var newhref = $(data).find('.page_next .next').attr('href'); //找出新的下一页链接
                        if (newhref != undefined) {
                            $('.page_next .next').attr('href', newhref);
                            let mToast = new QToast();
                            mToast.setMessage('加载成功');
                            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                            mToast.setTime(1500);
                            mToast.show();
                        } else {
                            $('.page_next').html('<span class="py-3 text-sm text-gray-400 dark:text-gray-500">我也是有底线的~</span>');
                            //$('.page_next .next').remove(); 如果没有下一页了，隐藏
                            let mToast = new QToast();
                            mToast.setMessage('最后一页咯~');
                            mToast.setType(mToast.TOAST_TYPE_INFO);
                            mToast.setTime(1500);
                            mToast.show();
                        }
                        Sleek.get_post_support();
                        Sleek.lazyload();
                        Sleek.ViewImage();
                        Sleek.postItems();
                    }
                });
            }
            return false;
        });
    },
    ajax_login: function () {
        $('#showLogin').on('click', function () {
            let mTipsPage = new QTipsPage('#Login');
            mTipsPage.setCancelButton(function () {
                mTipsPage.close();
            });
            mTipsPage.show();
        });
        $('.login_button').on('click', function (event) {
            event.preventDefault();
            var COOKIE_type = $.md5(window.location.href.replace(/\/$/, '')) + '__typecho_notice_type';
            var COOKIE_text = $.md5(window.location.href.replace(/\/$/, '')) + '__typecho_notice';
            deleteCookie(COOKIE_type, "." + window.location.hostname, '/');
            deleteCookie(COOKIE_text, "." + window.location.hostname, '/');

            var formData = {
                name: $('input[name="name"]').val(),
                password: $('input[name="password"]').val(),
                remember: $('input[name="remember"]').is(':checked') ? 1 : 0,
                referer: $('input[name="referer"]').val()
            };

            if (formData.name.trim() === '' || formData.password.trim() === '') {
                let mToast = new QToast();
                mToast.setMessage('请输入用户名和密码');
                mToast.setType(mToast.TOAST_TYPE_WARNING);
                mToast.setTime(2000);
                mToast.show();
                return; // 终止函数执行
            }

            $.ajax({
                url: $('#loginForm').attr('action'),
                type: 'POST',
                data: formData,
                dataType: 'html',
                success: function (response) {
                    COOKIE_type = $.md5(window.location.href.replace(/\/$/, '')) + '__typecho_notice_type';
                    COOKIE_text = $.md5(window.location.href.replace(/\/$/, '')) + '__typecho_notice';
                    if (getCookie(COOKIE_type) == 'error') {
                        let mToast = new QToast();
                        mToast.setMessage(JSON.parse(getCookie(COOKIE_text))[0]);
                        mToast.setType(mToast.TOAST_TYPE_WARNING);
                        mToast.setTime(2000);
                        mToast.show();
                    } else if (document.cookie.includes('PHPSESSID')) {
                        let mToast = new QToast();
                        mToast.setMessage('登录成功');
                        mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                        mToast.setTime(2000);
                        mToast.show();

                        pjax.load(Config.homeUrl, { selectors: ['.container', 'footer'] });

                        let mTipsPage = new QTipsPage('#Login');
                        mTipsPage.close();
                    } else {
                        let mToast = new QToast();
                        mToast.setMessage('登录失败');
                        mToast.setType(mToast.TOAST_TYPE_WARNING);
                        mToast.setTime(2000);
                        mToast.show();
                    }
                },
                error: function (xhr, status, error) {
                    let mToast = new QToast();
                    mToast.setMessage('登录出错');
                    mToast.setType(mToast.TOAST_TYPE_WARNING);
                    mToast.setTime(2000);
                    mToast.show();
                    console.log(error);
                }
            });
        });
    },
    ajax_post: function () {
        $('#showNew_post').on('click', function () {
            $('body').removeClass("nav-open");
            var mBottomActionDialog1 = new QBottomActionDialog('#New_post');
            mBottomActionDialog1.setCancelButtonOnClick(function () {
                mBottomActionDialog1.close();
            });
            mBottomActionDialog1.setCanceledonScrollOutside(true);
            mBottomActionDialog1.show();
            $('#New_post .qui-bottom-action-content').css('height', '90%');
            $('#category-1').prop('checked', true);
        });

        $('#comment-allow').on('click', function () {
            $('.comment-allow').toggleClass("border text-blue-400");
            $('.comment-allow .ri-chat-check-line,.comment-allow .ri-chat-delete-fill').toggleClass("hidden");
            if ($('#comment-allow').is(':checked')) {
                let mToast = new QToast();
                mToast.setMessage('评论已关闭~');
                mToast.setType(mToast.TOAST_TYPE_INFO);
                mToast.setTime(2000);
                mToast.show();
            } else {
                let mToast = new QToast();
                mToast.setMessage('评论已开启~');
                mToast.setType(mToast.TOAST_TYPE_INFO);
                mToast.setTime(2000);
                mToast.show();
            }
        })

        $('#article-form').submit(function (event) {
            event.preventDefault(); // 阻止表单默认提交行为

            // 获取表单数据
            if ($('#category-1').is(':checked')) {
                var title = '随笔#' + $('#title').val();
            } else {
                var title = $('#title').val();
            }
            var text = $('#post-textarea').val();
            var password = $('#post_password').val();
            var category = $('input[name="category"]:checked').map(function () {
                return $(this).val();
            }).get().join(',');
            var tags = $('#tags').val();
            if ($('#secret-button3').is(':checked')) {
                var visibility = 'private';
            } else {
                var visibility = '';
            }
            if ($('#comment-allow').is(':checked')) {
                var allowComment = '0';
            } else {
                var allowComment = '1';
            }

            // 创建请求数据对象
            var requestData = {
                title: title,
                text: text,
                category: category,
                tags: tags,
                visibility: visibility,
                password: password,
                allowComment: allowComment
            };

            // 发送Ajax请求
            $.ajax({
                url: `/?action=publishArticle`, // 替换为实际的后端处理路径
                type: 'POST',
                data: requestData,
                dataType: 'json',
                success: function (res) {
                    // 处理成功响应
                    /* console.log(res.status) */
                    if (res.status === 'success') {
                        /* console.log(res.content) */
                        // 清空表单
                        $('#title').val('');
                        $('#category').val('');
                        $('#tags').val('');
                        $('#password').val('');
                        $('#post-textarea').val('');
                        var editor = tinymce.get('post-textarea'); // 替换为你的编辑器实例的ID
                        editor.setContent('');
                        let mToast = new QToast();
                        mToast.setMessage('发布成功');
                        mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                        mToast.setTime(2000);
                        mToast.show();
                        /* pjax.load(Config.homeUrl,{ selectors: ['main','footer']}); */
                        setTimeout(function () {
                            window.location.reload();
                        }, 500);
                    } else {
                        let mToast = new QToast();
                        mToast.setMessage('发布失败');
                        mToast.setType(mToast.TOAST_TYPE_WARNING);
                        mToast.setTime(2000);
                        mToast.show();
                    }
                },
                error: function () {
                    // 处理请求失败
                    let mToast = new QToast();
                    mToast.setMessage('请求失败，请重试');
                    mToast.setType(mToast.TOAST_TYPE_WARNING);
                    mToast.setTime(2000);
                    mToast.show();
                }
            });
        });
    },
    ajax_Comment: function () {
        $('#p-comments-from').submit(function (event) {
            var commentdata = $(this).serializeArray();
            $.ajax({
                url: $(this).attr('action'),
                type: $(this).attr('method'),
                data: commentdata,
                beforeSend: function () {
                    let mToast = new QToast();
                    mToast.setMessage('评论中...');
                    mToast.setType(mToast.TOAST_TYPE_INFO);
                    mToast.setTime(5000);
                    mToast.show();
                },
                error: function (request) {
                    console.clear();
                    var extractedContent = request.responseText.split('<div class="container">')[1].split('</div>')[0];
                    var sanitizedContent = extractedContent.replace(/<br\s*\/?>/g, ',').replace(/[\r\n]/g, ' ');
                    var inputs = $(".user-info-body input[placeholder^='*']");
                    var isEmpty = false;

                    inputs.each(function () {
                        if ($(this).val().trim() === "") {
                            isEmpty = true;
                            return false; // 结束循环
                        }
                    });

                    if (isEmpty) {
                        $(".user-info-body").slideDown("slow");
                    } else {
                        $(".user-info-body").slideUp("slow");
                    }

                    let mToast = new QToast();
                    mToast.setMessage(sanitizedContent);
                    mToast.setType(mToast.TOAST_TYPE_WARNING);
                    mToast.setTime(2000);
                    mToast.show();
                    // 重置标志变量为 false，以便下次点击时可以执行 AJAX 请求
                    isAJAXExecuted2 = false;
                },
                success: function (data) {
                    var error = /<title>Error<\/title>/;
                    if (error.test(data)) {
                        var text = data.match(/<div(.*?)>(.*?)<\/div>/is);
                        var str = '发生了未知错误'; if (text != null) str = text[2];
                        var text = $("#message-textarea").val();
                        var author = $("#author").val();
                        var mail = $("#mail").val();
                        var newUrl = str.replace(".html", ".html/comment?text=" + text + "&author=" + author + "&mail=" + mail + "&url=");

                        let mToast = new QToast();
                        mToast.setMessage('评论失败~' + newUrl + '');
                        mToast.setType(mToast.TOAST_TYPE_WARNING);
                        mToast.setTime(2000);
                        mToast.show();
                    } else {
                        // 数字+1
                        var numis = $('.pjax-content .page_tab_active').find('sup').text();
                        var num = parseInt(numis);
                        $('.pjax-content .page_tab_active').find('sup').text(num + 1);

                        // 清空表单内容
                        $("#p-comments-from")[0].reset();


                        $('.comment').html($('.comment', data).html());
                        $('.comments-title').html($('.comments-title', data).html());
                        $('.p-omments-lists').html($('.p-omments-lists', data).html());

                        var biggestNum = 0;
                        $('li[id^="comment-"]').each(function () {
                            var currentNum = parseInt($(this).attr('id').replace('comment-', ''), 0);
                            if (currentNum > biggestNum) {
                                biggestNum = currentNum;
                            }
                        });

                        var commentContainer = $(".page_content"); // 滚动容器
                        var targetComment = $('#comment-' + biggestNum); // 目标评论

                        // 计算目标评论相对于滚动容器的偏移量
                        if (targetComment.length > 0) {
                            var offset = targetComment.offset().top - commentContainer.offset().top + commentContainer.scrollTop();
                            $(".page_content").animate({
                                scrollTop: offset - 15 + 'px'
                            }, {
                                duration: 600,
                                easing: "linear"
                            });
                        }

                        if ($('#secret-button').is(':checked') == false) {
                            $(".comment-respond textarea").attr('placeholder', '评论成功！');
                            $(".comment-respond textarea").removeClass("secret-textarea");
                            $(".comment-secret").removeClass("border border-blue-400");
                            $('.ri-chat-private-line,.ri-chat-private-fill').toggleClass('hidden');
                        }
                        let mToast = new QToast();
                        mToast.setMessage('评论成功');
                        mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                        mToast.setTime(2000);
                        mToast.show();
                    }
                }
            });
            return false;
        });
    },
    postItems: function () {
        // 获取所有的post-item元素  
        var postItems = document.querySelectorAll('.post-item');
        // 对每一个post-item元素添加点击事件监听  
        postItems.forEach(function (postItem) {
            var showBottomActions = postItem.querySelectorAll('.showBottomAction');
            var videos = postItem.querySelectorAll('video');

            videos.forEach(function (video) {
                video.addEventListener('loadedmetadata', function () {
                    var width = video.offsetWidth;
                    var height = video.offsetHeight;

                    if (width > height) {
                        video.parentNode.classList.add('hen');
                    } else {
                        video.parentNode.classList.add('shu');
                    }
                });
            });
            showBottomActions.forEach(function (showBottomAction) {
                showBottomAction.addEventListener('click', function () {
                    // 获取该post-item元素的data-cid属性  
                    var cid = postItem.getAttribute('data-cid');
                    var commentsumElement = showBottomAction.querySelector('small');
                    var commentsum = commentsumElement.innerText;
                    var allowComment = postItem.getAttribute('data-allowComment');
                    if (!isAJAXExecuted) { // 判断是否已经执行过 AJAX 请求
                        isAJAXExecuted = true; // 设置标志变量为 true
                        $.ajax({
                            url: `/?action=getpostcomments`,
                            type: 'POST',
                            data: {
                                cid: cid
                            },
                            dataType: 'json',
                            success: res => {
                                if (res.success) {
                                    var comments = JSON.parse(res.data);
                                    $("#BottomActionDialog .qui-bottom-action-panel .comments-list").fadeIn();
                                    if (comments.length > 0) {
                                        $('#BottomActionDialog .qui-bottom-action-header-btn-confirm').html('<span>' + commentsum + '</span><font> 条评论</font>');

                                        $('.comments-null').hide();
                                        // 创建一个字典对象用于存储评论的coid和author和mail的对应关系
                                        var authorDict = {};
                                        comments.forEach(function (comment) {
                                            var commentId = comment.coid;
                                            var author = comment.author;
                                            var mail = comment.mail;
                                            authorDict[commentId] = { author: author, mail: mail };
                                        });

                                        // 构建树形结构：父评论和子评论
                                        var commentTree = [];
                                        var commentMap = {};

                                        // 第一遍：将所有评论放入 map
                                        comments.forEach(function (comment) {
                                            comment.children = [];
                                            commentMap[comment.coid] = comment;
                                        });

                                        // 第二遍：构建父子关系
                                        comments.forEach(function (comment) {
                                            if (comment.parent == 0) {
                                                // 父评论
                                                commentTree.push(comment);
                                            } else {
                                                // 子评论，添加到父评论的 children 中
                                                if (commentMap[comment.parent]) {
                                                    commentMap[comment.parent].children.push(comment);
                                                } else {
                                                    // 如果找不到父评论，作为顶级评论处理
                                                    commentTree.push(comment);
                                                }
                                            }
                                        });

                                        // 递归渲染评论树
                                        function renderComment(comment, isChild) {
                                            var cid = comment.cid;
                                            var actionUrl = Config.homeUrl + 'archives/' + cid + '/comment';
                                            var commentId = comment.coid;
                                            var author = comment.author;
                                            var ip = comment.ip;
                                            if (comment.mail == null) {
                                                var commentmail = 'irils@qq.com';
                                            } else {
                                                var commentmail = comment.mail;
                                            }
                                            var mail = $.md5(commentmail);
                                            var date = formatTime(comment.created);
                                            var parentCoid = comment.parent;
                                            if (comment.url == null) {
                                                url = '#';
                                            } else {
                                                var url = comment.url;
                                            }

                                            // 如果父评论的coid存在于字典中，则获取其对应的author名称
                                            var atauthor = "";
                                            if (parentCoid != 0 && authorDict.hasOwnProperty(parentCoid)) {
                                                var parentAuthor = authorDict[parentCoid].author;
                                                var parentMail = authorDict[parentCoid].mail;
                                                atauthor = `<a class="text-blue-400 commentat" href="#comment-${parentCoid}">@${parentAuthor}，</a>`;
                                            }

                                            var mClass = (comment.mail === Config.mail) ? 'messages-r' : 'messages-l';
                                            var content = marked(comment.text);

                                            if (content.indexOf('[secret]') === -1) {
                                                var commentContent = marked(atauthor + comment.text);
                                            } else {
                                                if (Config.login == "true" || Config.mail === comment.mail || Config.mail === parentMail) {
                                                    var commentContent = content.replace(/\[secret\](.*?)\[\/secret\]/g, function (match, p1) {
                                                        return "<div class=\"secret\">" + atauthor + p1 + "</div>";
                                                    });
                                                } else {
                                                    var commentContent = content.replace(/\[secret\](.*?)\[\/secret\]/g, "<div class=\"secret\">此条为悄悄话，仅发布者和" + atauthor + "评论双方可见</div>");
                                                }
                                            }

                                            if (allowComment == '0') {
                                                var commentat = "";
                                            } else if (allowComment == '1') {
                                                var commentat = `<div id="createReply" onclick="createReply('${commentId}','${author}') " title="回复给${author}" class="messages-at w-full h-full absolute left-0 top-0 flex justify-center items-center bg-gray-50 dark:bg-slate-700 cursor-pointer">@</div>`;
                                            }

                                            // 添加缩进样式（子评论）
                                            var indentClass = isChild ? 'ml-8' : '';

                                            var commentText = `
                                                    <div id="comment-${commentId}" class="messages ${mClass} ${indentClass}" data-coid="${commentId}" data-author="${author}" data-parentCoid="${parentCoid}" action="${actionUrl}">
                                                        <div class="avatar rounded border dark:border-slate-700 relative skeleton-loading">
                                                            <img class="rounded lazyload" data-src="https://cravatar.cn/avatar/${mail}?&d=mm&s=200" src="https://rz.sb/usr/themes/A-Sleek/src/img/loading.svg" alt="tx" width="32" height="32" />
                                                            ${commentat}
                                                        </div>
                                                        <div class="content">
                                                            <div class="content-info flex gap-2 mb-1">
                                                                <a href="${url}" class="name flex" target="_blank">${author}</a>
                                                                <small class="messages-time text-gray-400 dark:text-gray-500">${date}</small>
                                                            </div>
                                                            <div title="${date}" class="contents rounded-md shadow-sm bg-gray-50 dark:bg-slate-700" view-image>
                                                                <div class="text break-all">${commentContent}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    `;
                                            $("#BottomActionDialog .qui-bottom-action-panel .comments-list").append(commentText);

                                            // 递归渲染子评论
                                            if (comment.children && comment.children.length > 0) {
                                                comment.children.forEach(function (childComment) {
                                                    renderComment(childComment, true);
                                                });
                                            }
                                        }

                                        // 按时间倒序排列顶级评论（最新的在最后）
                                        commentTree.sort(function (a, b) {
                                            return a.created - b.created;
                                        });

                                        // 渲染所有顶级评论及其子评论
                                        commentTree.forEach(function (comment) {
                                            renderComment(comment, false);
                                        });

                                        $("#BottomActionDialog .qui-bottom-action-panel .comments-list").fadeIn();

                                        var postUrl = '<div class="more-comment w-full text-sm text-center pb-2"><a href=' + Config.homeUrl + 'archives/' + cid + '#p_comments' + '>......</a></div>';

                                        if (commentsum > 20) {
                                            $("#BottomActionDialog .qui-bottom-action-panel .comments-lists").prepend(postUrl);
                                        } else {
                                            $(".more-comment").remove();
                                        }
                                        $("#BottomActionDialog .qui-bottom-action-panel").scrollTop(10000);
                                    } else {
                                        $('.comments-null').show();
                                        $('#BottomActionDialog .qui-bottom-action-header-btn-confirm').html('<span>暂无评论</span><font></font>');
                                    }

                                    if (allowComment == '0') {
                                        $("#BottomActionDialog #comment-form").find('textarea,input').prop('disabled', true).attr('placeholder', '此文章已关闭评论');
                                        $("#BottomActionDialog #comment-form").css('pointer-events', 'none');
                                    } else if (allowComment == '1') {
                                        $("#BottomActionDialog #comment-form").find('textarea,input').prop('disabled', false);
                                        $("#BottomActionDialog #comment-form").css('pointer-events', 'auto');
                                        $("#BottomActionDialog #comment-form").find('textarea').attr('placeholder', '说点什么吧...');
                                    }
                                    var actionUrls = Config.homeUrl + 'archives/' + cid + '/comment';
                                    var respondID = 'respond-post-' + cid;
                                    $('#comment-form').attr('action', actionUrls);
                                    $('.respond').attr('id', respondID);
                                } else {
                                    console.log("响应数据为空");
                                }
                                // 重置标志变量为 false，以便下次点击时可以执行 AJAX 请求
                                isAJAXExecuted = false;

                            }
                        });
                    }

                    var mBottomActionDialog1 = new QBottomActionDialog('#BottomActionDialog');
                    mBottomActionDialog1.setConfirmButtonOnClick(function () {
                        var postUrl = Config.homeUrl + 'archives/' + cid + '';
                        pjax.load(postUrl);
                    });
                    mBottomActionDialog1.setCancelButtonOnClick(function () {
                        mBottomActionDialog1.close();
                        $(".more-comment").remove();
                    });
                    mBottomActionDialog1.setCanceledonScrollOutside(true);
                    mBottomActionDialog1.show();

                    // 弹窗打开后滚动到底部（显示输入框）
                    setTimeout(function () {
                        $('.qui-bottom-action-panel .comments-lists').scrollTop($('.qui-bottom-action-panel .comments-lists')[0].scrollHeight);
                    }, 300);
                });
            });
        });

        function scrollToComment(commentId) {
            // 获取评论的偏移位置
            var commentOffset = $('.comments').offset().top;
            // 计算目标评论的偏移位置
            var targetOffset = $('#' + commentId).offset().top;
            // 滚动到目标评论位置
            $('.qui-bottom-action-panel,.page_content').animate({ scrollTop: targetOffset - commentOffset }, 500, function () {
                // 滚动完成后给评论添加淡入效果
                $('#comment-' + commentId).fadeIn();
                /* console.log(commentId); */
            });
        }

        // 点击事件处理函数
        $('.comments-list a[href^="#comment-"]').on('click', function (event) {
            event.preventDefault(); // 阻止默认的链接跳转行为
            var commentId = $(this).attr('href').substring(1); // 获取评论 ID
            scrollToComment(commentId); // 调用函数进行滚动跳转
        });

        $("#BottomActionDialog #comment-form").submit(function (event) {
            event.preventDefault(); // 阻止表单默认提交行为
            var formData = $(this).serialize(); // 获取表单数据
            $this = $(this);
            // 判断是否存在 .comments-null 元素，如果存在则删除
            if ($this.closest('#BottomActionDialog .qui-bottom-action-content').find('.comments-null').length > 0) {
                $this.closest('#BottomActionDialog .qui-bottom-action-content').find('.comments-null').fadeOut();
            }

            // 判断是否为 "暂无评论"，如果是，则替换为初始评论数
            var cancelBtn = $this.closest('#BottomActionDialog .qui-bottom-action-content').find('.qui-bottom-action-header-btn-confirm');
            if (cancelBtn.text() === '暂无评论') {
                cancelBtn.html('<span>0</span> <font>条评论</font>');
            }
            var urls = $("#comment-form").attr('action');
            var startIndex = urls.indexOf('archives/') + 9;
            var endIndex = urls.indexOf('/comment');
            var cid = urls.substring(startIndex, endIndex);

            if (!isAJAXExecuted2) { // 判断是否已经执行过 AJAX 请求
                isAJAXExecuted2 = true; // 设置标志变量为 true
                $.ajax({
                    url: $("#comment-form").attr('action'), // 替换为实际的评论提交 URL
                    type: 'POST',
                    data: formData,
                    success(data) {
                        var error = /<title>Error<\/title>/;
                        if (error.test(data)) {
                            var text = data.match(/<div(.*?)>(.*?)<\/div>/is);
                            var str = '发生了未知错误'; if (text != null) str = text[2];
                            var text = $("#message-textarea").val();
                            var author = $("#author").val();
                            var mail = $("#mail").val();
                            var newUrl = str.replace(".html", "/comment?text=" + text + "&author=" + author + "&mail=" + mail + "&url=");

                            let mToast = new QToast();
                            mToast.setMessage('评论失败~' + newUrl + '');
                            mToast.setType(mToast.TOAST_TYPE_WARNING);
                            mToast.setTime(2000);
                            mToast.show();
                        } else {

                            // 数字+1
                            var numis = cancelBtn.find('span').text();
                            var num = parseInt(numis);
                            cancelBtn.find('span').text(num + 1);

                            var comments_numElement = $('article[data-cid="' + cid + '"] .showBottomAction').find('small');
                            comments_numElement.text(num + 1);

                            // 清空表单内容
                            $("#comment-form")[0].reset();


                            // 添加新评论到评论列表
                            var newComment = {};
                            formData.split('&').forEach(function (entry) {
                                var field = entry.split('=');
                                newComment[field[0]] = decodeURIComponent(field[1]);
                            });
                            var authorDict2 = {};
                            var commentcoid = document.querySelectorAll('#BottomActionDialog .qui-bottom-action-panel .comments-list .messages');
                            commentcoid.forEach(function (comment) {
                                var commentId = comment.getAttribute('data-coid');
                                var author = comment.getAttribute('data-author');
                                authorDict2[commentId] = author;
                            });
                            var parentCoid = newComment.parent;
                            // 如果父评论的coid存在于字典中，则获取其对应的author名称
                            if (parentCoid != 0 && authorDict2.hasOwnProperty(parentCoid)) {
                                var parentAuthor = authorDict2[parentCoid];
                                var atauthor = `<a class="text-blue-400" href="#comment-${parentCoid}">@${parentAuthor}</a>，`;
                            } else {
                                var atauthor = "";
                            }
                            /* var author = $("#author").val();
                            var mail = $("#mail").val(); */
                            var author = Config.author;
                            var mail = Config.mail;
                            if (Config.login == "true") {
                                var url = '#';
                            } else {
                                var url = newComment.url ? newComment.url : '#';
                            }
                            var text = marked(atauthor + newComment.text);

                            if ($(".secret-textarea").length > 0) {
                                var commentContent = `<div class="secret">${text}</div>`;
                            } else {
                                var commentContent = text;
                            }

                            var commentText = `
                            <div class="messages messages-r" data-parentCoid="${parentCoid}">
                                <div class="avatar rounded border dark:border-slate-700 relative skeleton-loading">
                                    <img class="rounded lazyload" src="https://cravatar.cn/avatar/${$.md5(mail)}?&d=mm&s=200" alt="tx" width="32" height="32" />
                                </div>
                                <div class="content">
                                    <div class="content-info flex gap-2 mb-1">
                                        <a href="${url}" class="name flex" target="_blank">${author}</a>
                                    </div>
                                    <div class="contents rounded-md shadow-sm bg-gray-50 dark:bg-slate-700">
                                        <div class="text break-all" view-image>${commentContent}</div>
                                    </div>
                                </div>
                            </div>
                            `;
                            var newCommentElement = $(commentText).hide(); // 创建新评论的jQuery对象并隐藏
                            $("#BottomActionDialog .qui-bottom-action-panel .comments-list").append(newCommentElement); // 将新评论添加到评论列表
                            newCommentElement.fadeIn(); // 使用fadeIn()方法淡入显示新评论
                            // 滚动到最新评论
                            $("#BottomActionDialog .qui-bottom-action-panel").scrollTop(10000);

                            if ($('#secret-button2').is(':checked') == false) {
                                $(".comment-respond textarea").removeClass("secret-textarea");
                                $(".comment-secret").removeClass("border border-blue-400");
                                $('.ri-chat-private-line,.ri-chat-private-fill').toggleClass('hidden');
                                $(".comment-respond textarea").attr('placeholder', '评论成功！');
                            }
                            $('#comment-parent').remove();
                            $(".Comments_publisher textarea").val('');
                            $('#cancelReply').text('').css('display', 'none');


                            let mToast = new QToast();
                            mToast.setMessage('评论成功');
                            mToast.setType(mToast.TOAST_TYPE_SUCCESS);
                            mToast.setTime(1500);
                            mToast.show();
                        }

                        // 重置标志变量为 false，以便下次点击时可以执行 AJAX 请求
                        isAJAXExecuted2 = false;
                    },
                    error: function (request) {
                        console.clear();
                        var extractedContent = request.responseText.split('<div class="container">')[1].split('</div>')[0];
                        var sanitizedContent = extractedContent.replace(/<br\s*\/?>/g, ',').replace(/[\r\n]/g, ' ');
                        var inputs = $(".user-info-body input[placeholder^='*']");
                        var isEmpty = false;

                        inputs.each(function () {
                            if ($(this).val().trim() === "") {
                                isEmpty = true;
                                return false; // 结束循环
                            }
                        });

                        if (isEmpty) {
                            $(".user-info-body").slideDown("slow");
                        } else {
                            $(".user-info-body").slideUp("slow");
                        }

                        let mToast = new QToast();
                        mToast.setMessage(sanitizedContent);
                        mToast.setType(mToast.TOAST_TYPE_WARNING);
                        mToast.setTime(2000);
                        mToast.show();
                        // 重置标志变量为 false，以便下次点击时可以执行 AJAX 请求
                        isAJAXExecuted2 = false;
                    }
                });
            }
        });

    },
    tinymce: function () {
        tinymce.init({
            selector: '#post-textarea',
            language: 'zh_CN',
            plugins: 'advlist autolink link image lists preview save code emoticons table', //字符串方式
            toolbar: 'undo redo removeformat | styleselect | emoticons bold italic underline strikethrough link image code | alignleft aligncenter alignright alignjustify | outdent indent | numlist bullist | table',
            menubar: false,
            promotion: false,
            branding: false,
            auto_focus: true,
            setup: function (editor) {
                editor.on('change', function () {
                    editor.save(); // 在编辑器内容发生改变时保存内容
                });
            }
        });
    },
    Other: function () {
        //悄悄话
        let holder = $('.comment-respond textarea').attr('placeholder');
        $('#secret-button,#secret-button2,#secret-button3').click(function () {
            let textareaDom = $('.comment-respond textarea,#post-textarea');
            textareaDom.toggleClass("secret-textarea");
            $(".comment-secret").toggleClass("border text-blue-400");
            $('.ri-chat-private-line,.ri-chat-private-fill').toggleClass('hidden');
            if ($(this).is(':checked')) {
                textareaDom.attr('placeholder', '开启悄悄话~')
                let mToast = new QToast();
                mToast.setMessage('开启悄悄话~');
                mToast.setType(mToast.TOAST_TYPE_INFO);
                mToast.setTime(2000);
                mToast.show();
            } else {
                textareaDom.attr('placeholder', holder)
                let mToast = new QToast();
                mToast.setMessage('关闭悄悄话~');
                mToast.setType(mToast.TOAST_TYPE_INFO);
                mToast.setTime(2000);
                mToast.show();
            }
        });

        $('.rm_hidden').prev('p').addClass("inline");
        $('.menu_button,.nav-mask').click(function () {
            $('body').toggleClass("nav-open");
        });

        $('.user-info').on('click', function () {
            $('.user-info-body').slideToggle();
        })

        $('#emoji-icons-btn,#emoji-icons-btn2').on('click', function () {
            $('.emoji-icons').slideToggle();
            $('#emoji-icons-btn,#emoji-icons-btn2').toggleClass("border text-blue-400");
        })

        $('#showLoadingTip').on('click', function () {
            let mLoadingTip = new QLoadingTip();
            mLoadingTip.setMessage('搜索中...');
            //mLoadingTip.setType(mLoadingTip.LOADING_TYPE_TOP);
            mLoadingTip.setTime(2000);
            //mBottomActionDialog.setCancelable(true);
            mLoadingTip.show();
        });


        //统计相册
        var masonrys = $(".masonry-container").find(".masonry-item");
        if (masonrys.length > 0) {
            $(".masonry-content").find(".page_tab_active .count").get(0).innerText = '' + masonrys.length + '';
        }
        //统计友链
        var links = $(".links_content").find(".link_a");
        if (links.length > 0) {
            $(".links-head").find(".page_tab_active .count").get(0).innerText = '' + links.length + ' (随机排序)';
        }

        setTimeout(function () {
            $('.page-loader').fadeOut();
            pg = true;
        }, 1000);

        const message = document.getElementsByName("text");

        const emojiIcons = document.querySelectorAll(".emoji-icon");
        emojiIcons.forEach((icon) => {
            icon.addEventListener("click", (event) => {
                event.preventDefault();
                const emoji = event.target.innerHTML;
                for (let i = 0; i < message.length; i++) {
                    message[i].value += emoji;
                }
            });
        });

        $('.markdown-body code').each(function () {
            var classes = $(this).attr('class'); // 获取元素的类属性
            if (classes && classes.match(/lang-/)) { // 检查类属性是否存在，并判断是否具有以lang-开头的类
                var lang = classes.split('-')[1]; // 获取lang后的字符
                var span = $('<span class="lang-type text-slate-400">').text(lang); // 创建一个<span>元素，并将lang作为文本内容
                $(this).parent('pre').prepend(span); // 将<span>元素插入到<pre>标签内部
            } else {
                var lang = 'text';
                var span = $('<span class="lang-type text-slate-400">').text(lang); // 创建一个<span>元素，并将lang作为文本内容
                $(this).parent('pre').prepend(span); // 将<span>元素插入到<pre>标签内部
            }
        });

        var tags = $('#tags'), tagsPre = [];
        if (tags.length > 0) {
            var items = tags.val().split(','), result = [];
            for (var i = 0; i < items.length; i++) {
                var tag = items[i];

                if (!tag) {
                    continue;
                }

                tagsPre.push({
                    id: tag,
                    tags: tag
                });
            }
            tags.tokenInput(tagConfig.tokenInputs, {
                propertyToSearch: 'tags',
                tokenValue: 'tags',
                searchDelay: 0,
                preventDuplicates: true,
                animateDropdown: false,
                hintText: '请输入标签名',
                noResultsText: '此标签不存在, 按回车创建',
                prePopulate: tagsPre,

                onResult: function (result, query, val) {
                    if (!query) {
                        return result;
                    }

                    if (!result) {
                        result = [];
                    }

                    if (!result[0] || result[0]['id'] != query) {
                        result.unshift({
                            id: val,
                            tags: val
                        });
                    }

                    return result.slice(0, 5);
                }
            });
            $('.token-input-token').addClass("bg-white dark:bg-slate-800");
            $('.token-input-list').addClass("flex items-center gap-2 w-full rounded mt-3 p-2 bg-gray-50 dark:bg-slate-700 text-sm text-slate-500 border dark:border-slate-700");
            $('#token-input-tags').addClass("bg-gray-50 dark:bg-slate-700 placeholder:text-slate-400/70");
            $('#token-input-tags').attr('placeholder', '标签');
            // tag autocomplete 提示宽度设置
            $('#token-input-tags').focus(function () {
                var t = $('.token-input-dropdown'),
                    offset = t.outerWidth() - t.width();
                t.width($('.token-input-list').outerWidth() - offset);
            });
        }

    }
}
Sleek.PjaxLoad = function () {
    Sleek.GoTop();
    Sleek.lazyload();
    Sleek.ViewImage();
    Sleek.menu_active();
    Sleek.menu_tab();
    Sleek.ajax_login();
    Sleek.ajax_post();
    Sleek.ajax_Comment();
    Sleek.postItems();
    Sleek.load_readmore();
    Sleek.get_post_support();
    Sleek.page_next();
    Sleek.tinymce();
    Sleek.Other();

};
Sleek.PjaxLoad();

const pjax = new Pjax({
    selectors: [
        'title', 'main', '.nav_menu_foot', '.nav-mask', 'footer'
    ],
    scripts: 'script[data-pjax]',
    defaultTrigger: {
        exclude: 'a[no-pjax]',
    }
});
document.addEventListener('pjax:send', () => {
    $("html").addClass("loading");
});
document.addEventListener('pjax:success', () => {
    $("html").removeClass("loading");
    $('.pjax-content').fadeIn(1000);
    Sleek.PjaxLoad();
    $('body').removeClass("nav-open");
    if (Config.login == "true") {
        var targetElement = document.getElementById('post-textarea'); // 替换为你的目标元素ID
        var textareaElement = targetElement.querySelector('#post-textarea textarea'); // 如果目标元素是textarea，可以直接使用该元素
        // 移除旧的TinyMCE实例
        tinymce.remove(textareaElement);
        // 在目标元素上重新初始化TinyMCE
        Sleek.tinymce();
    }
});


