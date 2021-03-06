/*
*  Copyright 2014 TWO SIGMA OPEN SOURCE, LLC
*
*  Licensed under the Apache License, Version 2.0 (the "License");
*  you may not use this file except in compliance with the License.
*  You may obtain a copy of the License at
*
*         http://www.apache.org/licenses/LICENSE-2.0
*
*  Unless required by applicable law or agreed to in writing, software
*  distributed under the License is distributed on an "AS IS" BASIS,
*  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*  See the License for the specific language governing permissions and
*  limitations under the License.
*/

(function() {
  'use strict';
  var retfunc = function(plotUtils, PlotSampler, PlotArea, PlotLodLine, PlotLodRiver,
    PlotAuxRiver) {
    var PlotAreaLodLoader = function(data, lodthresh){
      this.datacopy = {};
      _(this.datacopy).extend(data);  // save for later use
      _(this).extend(data); // copy properties to itself
      this.lodthresh = lodthresh;
      this.format(lodthresh);
    };
    // class constants
    PlotAreaLodLoader.prototype.lodTypes = ["area", "river"];
    PlotAreaLodLoader.prototype.lodSteps = [5, 5];

    PlotAreaLodLoader.prototype.format = function() {
      // create plot type index
      this.lodTypeIndex = 0;
      this.lodType = this.lodTypes[this.lodTypeIndex]; // line, box

      // create the plotters
      this.zoomHash = plotUtils.randomString(3);
      this.plotter = new PlotArea(this.datacopy);
      this.createLodPlotter();

      // a few switches and constants
      this.isLodItem = true;
      this.lodOn = false;
      this.lodAuto = true;
      this.sampleStep = -1;
      if (this.color != null) {
        this.tip_color = plotUtils.createColor(this.color, this.color_opacity);
      } else {
        this.tip_color = "gray";
      }

      this.itemProps = {
        "id" : this.id,
        "st" : this.color,
        "st_op" : this.color_opacity,
        "st_w" : this.width,
        "st_da" : this.stroke_dasharray,
        "d" : ""
      };
      this.elementProps = [];
    };

    PlotAreaLodLoader.prototype.zoomLevelChanged = function(scope) {
      this.sampleStep = -1;
      this.zoomHash = plotUtils.randomString(3);
      if (this.lodOn === false) { return; }
      if (this.lodType === "area") {
        this.lodplotter.setZoomHash(this.zoomHash);
        this.lodplotter.clearTips(scope);
      } else if (this.lodType === "river"){
        this.lodplotter.setZoomHash(this.zoomHash);
        this.lodplotter2.setZoomHash(this.zoomHash);
        this.lodplotter.clearTips(scope);
        this.lodplotter2.clearTips(scope);
      }
    };

    PlotAreaLodLoader.prototype.applyZoomHash = function(hash) {
      this.zoomHash = hash;
      if (this.lodType === "area") {
        this.lodplotter.setZoomHash(hash);
      } else if (this.lodType === "river") {
        this.lodplotter.setZoomHash(hash);
        this.lodplotter2.setZoomHash(hash);
      }
    };

    PlotAreaLodLoader.prototype.switchLodType = function(scope) {
      this.clear(scope);
      this.lodTypeIndex = (this.lodTypeIndex + 1) % this.lodTypes.length;
      this.lodType = this.lodTypes[this.lodTypeIndex];
      this.createLodPlotter();
    };

    PlotAreaLodLoader.prototype.applyLodType = function(type) {
      this.lodType = type;
      this.lodTypeIndex = this.lodTypes.indexOf(type);  // maybe -1
      if (this.lodTypeIndex === -1) { this.lodTypeIndex = 0; }
      this.createLodPlotter();
    };

    PlotAreaLodLoader.prototype.createLodPlotter = function() {
      var data = {};
      _(data).extend(this.datacopy);
      if (this.lodType === "area") {
        this.lodplotter = new PlotLodRiver(data);
        this.lodplotter.setZoomHash(this.zoomHash);
      } else if (this.lodType === "river") {
        data.stroke = data.color;  // assume the user has no way to set outline for area
        data.color_opacity *= .25;
        data.stroke_opacity = 1.0;
        this.lodplotter = new PlotLodRiver(data);
        this.lodplotter2 = new PlotLodRiver(data);
        this.lodplotter.setZoomHash(this.zoomHash);
        this.lodplotter2.setZoomHash(this.zoomHash);

        _(data).extend(this.datacopy);
        this.auxplotter = new PlotAuxRiver(data);
      }
    };

    PlotAreaLodLoader.prototype.toggleLodAuto = function(scope) {
      this.lodAuto = !this.lodAuto;
      this.clear(scope);
    };

    PlotAreaLodLoader.prototype.applyLodAuto = function(auto) {
      this.lodAuto = auto;
    };

    PlotAreaLodLoader.prototype.toggleLod = function(scope) {
      if (this.lodType === "off") {
        this.lodType = this.lodTypes[this.lodTypeIndex];
      } else {
        this.lodType = "off";
      }
      this.clear(scope);
    };

    PlotAreaLodLoader.prototype.render = function(scope){
      if (this.showItem === false) {
        this.clear(scope);
        return;
      }

      this.filter(scope);

      var lod = false;
      if (this.lodType !== "off") {
        if ( (this.lodAuto === true && this.vlength > this.lodthresh) || this.lodAuto === false) {
          lod = true;
        }
      }

      if (this.lodOn != lod) {
        scope.legendDone = false;
        this.clear(scope);
      }
      this.lodOn = lod;

      if (this.lodOn === false) {
        this.plotter.render(scope);
        return;
      }

      this.sample(scope);
      if (this.lodType === "area") {
        this.lodplotter.render(scope, this.elementSamples);
      } else if (this.lodType === "river") {
        this.auxplotter.render(scope, this.elementAuxes, "a");
        this.lodplotter.render(scope, this.elementSamples, "yBtm");
        this.lodplotter2.render(scope, this.elementSamples2, "yTop");
      }
    };

    PlotAreaLodLoader.prototype.getRange = function(){
      return this.plotter.getRange();
    };

    PlotAreaLodLoader.prototype.applyAxis = function(xAxis, yAxis) {
      this.xAxis = xAxis;
      this.yAxis = yAxis;
      this.plotter.applyAxis(xAxis, yAxis);
      // sampler is created AFTER coordinate axis remapping
      this.createSampler();
    };

    PlotAreaLodLoader.prototype.createSampler = function() {
      var xs = [], ys = [], y2s = [], _ys = [], _y2s = [];
      for (var i = 0; i < this.elements.length; i++) {
        var ele = this.elements[i];
        xs.push(ele.x);
        ys.push(ele.y);
        y2s.push(ele.y2);
        _ys.push(ele._y);
        _y2s.push(ele._y2);
      }
      this.sampler = new PlotSampler(xs, ys, _ys);
      this.sampler2 = new PlotSampler(xs, y2s, _y2s);
    };

    PlotAreaLodLoader.prototype.filter = function(scope) {
      this.plotter.filter(scope);
      this.vindexL = this.plotter.vindexL;
      this.vindexR = this.plotter.vindexR;
      this.vlength = this.plotter.vlength;
    };

    PlotAreaLodLoader.prototype.sample = function(scope) {
      var xAxis = this.xAxis,
          yAxis = this.yAxis;
      var xl = scope.focus.xl, xr = scope.focus.xr;

      if (this.sampleStep === -1) {
        var pixelWidth = scope.plotSize.width;
        var count = Math.ceil(pixelWidth / this.lodSteps[this.lodTypeIndex]);
        var s = (xr - xl) / count;
        this.sampleStep = s;
      }

      var step = this.sampleStep;
      xl = Math.floor(xl / step) * step;
      xr = Math.ceil(xr / step) * step;

      this.elementSamples = this.sampler.sample(xl, xr, this.sampleStep);
      this.elementSamples2 = this.sampler2.sample(xl, xr, this.sampleStep);
      var count = this.elementSamples.length;

      if (this.lodType === "area") {
        var elements = [];
        for (var i = 0; i < count; i++) {
          elements.push({
            x : this.elementSamples[i].x,
            min : this.elementSamples[i].avg,
            max : this.elementSamples2[i].avg,
            hash : this.elementSamples[i].hash,
            xl : this.elementSamples[i].xl,
            xr : this.elementSamples[i].xr
          });
        }
        this.elementSamples = elements;
      } else if (this.lodType === "river") {
        this.elementAuxes = [];
        // prepare the aux river in between
        for (var i = 0; i < count; i++) {
          this.elementAuxes.push({
            x : this.elementSamples[i].x,
            y : this.elementSamples[i].max,
            y2 : this.elementSamples2[i].min
          });
        }
      }

    };

    PlotAreaLodLoader.prototype.clear = function(scope) {
      scope.maing.select("#" + this.id).selectAll("*").remove();
      this.clearTips(scope);
    };

    PlotAreaLodLoader.prototype.clearTips = function(scope) {
      if (this.lodOn === false) {
        this.plotter.clearTips(scope);
        return;
      }
      if (this.lodType === "area") {
        this.lodplotter.clearTips(scope);
      } else if (this.lodType === "river") {
        this.lodplotter.clearTips(scope);
        this.lodplotter2.clearTips(scope);
      }
    };

    PlotAreaLodLoader.prototype.createTip = function(ele, g) {
      if (this.lodOn === false) {
        return this.plotter.createTip(ele);
      }
      var xAxis = this.xAxis,
          yAxis = this.yAxis;
      var tip = {};
      var sub = "sample" + (g !== "" ? (" " + g) : "");
      if (this.legend != null) {
        tip.title = this.legend + " (" + sub + ")";
      }
      var eles = this.elements;
      tip.xl = plotUtils.getTipStringPercent(ele.xl, xAxis, 6);
      tip.xr = plotUtils.getTipStringPercent(ele.xr, xAxis, 6);
      if (this.lodType === "area") {
        tip.avg_yTop = plotUtils.getTipStringPercent(ele.max, yAxis, 6);
        tip.avg_yBtm = plotUtils.getTipStringPercent(ele.min, yAxis, 6);
      } else if (this.lodType === "river") {
        tip.max = plotUtils.getTipString(ele._max, yAxis, true);
        tip.min = plotUtils.getTipString(ele._min, yAxis, true);
        tip.avg = plotUtils.getTipStringPercent(ele.avg, yAxis, 6);
      }
      return plotUtils.createTipString(tip);
    };

    return PlotAreaLodLoader;
  };
  beaker.bkoFactory('PlotAreaLodLoader',
    ['plotUtils', 'PlotSampler', 'PlotArea', 'PlotLodLine', 'PlotLodRiver', 'PlotAuxRiver',
    retfunc]);
})();
