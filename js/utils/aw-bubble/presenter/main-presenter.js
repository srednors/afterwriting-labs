define(function(require) {

    var $ = require('aw-bubble/vendor/jquery'),
        Protoplast = require('aw-bubble/vendor/protoplast');

    var MainPresenter = Protoplast.Object.extend({

        themeModel: {
            inject: 'theme-model'
        },

        init: function() {

            Protoplast.utils.bind(this, 'themeModel.backgroundImageVisible', this._updateBackgroundImage);
            Protoplast.utils.bind(this, 'themeModel.nightMode', this._updateNightMode);

            this.themeModel.width = $('html').width();
            this.themeModel.height =  $(document).height();
            $(window).resize(function() {
                this.themeModel.width = $('html').width();
                this.themeModel.height =  $(document).height();
            }.bind(this));
        },

        _updateBackgroundImage: function() {
            var max_backgrounds = 7;
            if (this.themeModel.backgroundImageVisible) {
                $('html').css('background-image', 'url(' + 'gfx/bg' + Math.floor(Math.random() * max_backgrounds) + '.jpg)');
            }
            else {
                $('html').css('background-image', '');
            }
        },

        _updateNightMode: function() {
            if (this.themeModel.nightMode) {
                $('body').addClass('night-mode');
            }
            else {
                $('body').removeClass('night-mode');
            }
        }

    });

    return MainPresenter;
});