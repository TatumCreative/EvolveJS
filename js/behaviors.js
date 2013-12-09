var Evo = Evo || {};

Evo.BehaviorManager = (function() {
	
	var self = function() {
		this.currentBehaviors = [];
	};
	
	self.prototype = {
		
		update : function(dt) {
			for(var i in this.currentBehaviors) {
				this.currentBehaviors[i].update(dt);
			}
		},

		add : function(behavior) {
			if(this.currentBehaviors.indexOf(behavior) >= 0) return; //Do not add twice
			if(typeof behavior.onAdd === "function") behavior.onAdd();
			behavior.manager = this;
			this.currentBehaviors.push(behavior);
		},

		remove : function(behavior) {
			var index = this.currentBehaviors.indexOf(behavior);
			if(index >= 0) {
				if(typeof this.currentBehaviors[index] === "function") this.currentBehaviors[index].onRemove();
				this.currentBehaviors[index].manager = null;
				this.currentBehaviors.splice(index,1);
			}
		},

		has : function(behavior) {
			return this.currentBehaviors.indexOf(behavior) >= 0;
		},

		destroy : function() {

			//Run all behaviors "destroy" method if it exists
			for(var i = 0; i < this.currentBehaviors.length; ++i) {
				this.currentBehaviors[i].actor = null;
				if(typeof this.currentBehaviors[i].destroy === "function") {
					this.currentBehaviors[i].destroy();
				}
			}

			this.currentBehaviors.length = 0;
		},
				
		revert : function() {
			//Run all behaviors "destroy" method if it exists
			for(var i = 0; i < this.currentBehaviors.length; ++i) {
				if(typeof this.currentBehaviors[i].revert === "function") {
					this.currentBehaviors[i].revert();
				}
			}
		}
	};
	return self;
})();

Evo.Behavior = {};

Evo.Behavior.Roam = (function() {
	
	var self = function(actor) {
		this.actor = actor;
		
		this.speed = 0.05;
		this.direction = new Evo.Vector();
		
		this.direction.x = (Math.random() * 2) - 1;
		this.direction.y = (Math.random() * 2) - 1;
		if(Evo.Vector.is3d) this.direction.z = (Math.random() * 2) - 1;
		
		this.elapsedTime = 0;
	};
	
	self.prototype.update = function(dt) {
		
		this.direction.x = Math.min((Math.random() - 0.5) / 10 + this.direction.x, 1);
		this.direction.y = Math.min((Math.random() - 0.5) / 10 + this.direction.y, 1);
		if(Evo.Vector.is3d) this.direction.z = Math.min((Math.random() - 0.5) / 10 + this.direction.z, 1);
		
		this.actor.addWeightedDirection(this.direction, 1);
		this.actor.addWeightedSpeed(this.speed, 1);
		
		this.elapsedTime += dt;
		
	};
	
	return self;
})();

Evo.Behavior.FleeWalls = function(actor, canvas) {
	if(Evo.Vector.is2d) {
		return new Evo.Behavior.FleeWalls2d(actor, canvas);
	} else {	
		return new Evo.Behavior.FleeWalls3d(actor, canvas);
	}
};

Evo.Behavior.FleeWalls2d = (function() {
	
	var self = function(actor, canvas) {
		this.actor = actor;
		this.canvas = canvas;
		
		//The margin is a quarter of the document
		this.MARGIN = (this.canvas.width + this.canvas.height) / 4;
		this.direction = new Evo.Vector();
		this.weight = 0;
	};
	
	self.prototype.update = function() {
		
		this.direction.multiplyScalar(0);
		
		if(this.actor.position.x < this.MARGIN) {
			this.direction.x = ((this.MARGIN - this.actor.position.x) / this.MARGIN);
		}
		if(this.actor.position.y < this.MARGIN) {
			this.direction.y = ((this.MARGIN - this.actor.position.y) / this.MARGIN);
		}
		if(this.actor.position.x > this.canvas.width - this.MARGIN) {
			this.direction.x = -1 * ((this.MARGIN - (this.canvas.width - this.actor.position.x)) / this.MARGIN);
		}
		if(this.actor.position.y > this.canvas.height - this.MARGIN) {
			this.direction.y = -1 * ((this.MARGIN - (this.canvas.height - this.actor.position.y)) / this.MARGIN);
		}
		
		//If there is a direction to go
		if(this.direction.x !== 0 || this.direction.y !== 0) {
			
			//Crude/cheap weight calculator
			this.weight = this.direction.x * this.direction.x + this.direction.y * this.direction.y;
			this.direction.normalize();

			this.actor.addWeightedDirection(this.direction, this.weight * 2);
		}
	};
	
	return self;
})();

Evo.Behavior.FleeWalls3d = (function() {
	
	var self = function(actor, canvas) {
		this.actor = actor;
		this.canvas = canvas;
		
		//The margin is a quarter of the document
		this.MARGIN = 0;
		this.origin = new THREE.Vector3(0,75,0);
		this.direction = new THREE.Vector3(0,0,0);
		this.distance = 0;
		this.fleeStarts = 100;
		this.fleeStartsSquared = Math.pow(this.fleeStarts, 2);
		this.fleeEnds = 250;
		this.fleeEnds = Math.pow(this.fleeEnds, 2);
		this.fleeDenominator = this.fleeEnds - this.fleeStarts;
		
		this.direction = new THREE.Vector3(0,0,0);
		this.weight = 0;
	};
	
	self.prototype.update = function() {
		
		this.distance = this.origin.distanceToSquared(this.actor.position);
		
		if(this.distance > this.fleeStartsSquared) {
			
			this.direction.copy(this.actor.position).normalize().negate();

			//this.weight = Math.max(this.fleeMargin - (this.distance - this.fleeStarts), 0) / this.fleeMargin;
			this.weight = (this.distance - this.fleeStartsSquared) / this.fleeDenominator;

			this.actor.addWeightedDirection(this.direction, this.weight * 1);
		}
	};
	self.prototype.onAdd = function() {
		
	};
	self.prototype.onRemove = function() {
		
	};
	
	return self;
})();

Evo.Behavior.Boids2d = (function() {
	
	var self = function(actor) {
		
		if(Evo.Vector.is3d) console.warn ("Boids are not 3d capable");
		
		this.actor = actor;
		this.speed = 0.05;
		this.neighborsDirection = new Evo.Vector(0,0);
		this.neighborsPosition = new Evo.Vector(0,0);
		this.neighborsPositionSum = new Evo.Vector(0,0);
		
		this.direction = new Evo.Vector(
			(Math.random() * 2) - 1,
			(Math.random() * 2) - 1
		);
		
	};
	
	self.prototype.update = function() {
		
		if(!this.actor.gridNode) return;
		
		var	neighbors = this.actor.gridNode._nodeStack,
			i = 0,
			il = neighbors.length;
	
		this.neighborsDirection.x = 0;
		this.neighborsDirection.y = 0;
		
		for(; i < il; i++) {
			this.neighborsDirection.x += neighbors[i].direction.x;
			this.neighborsDirection.y += neighbors[i].direction.y;
			
			this.neighborsPosition.x = neighbors[i].position.x - this.actor.position.x;
			this.neighborsPosition.y = neighbors[i].position.y - this.actor.position.x;
			
			this.neighborsPosition.normalize();
			
			this.neighborsPositionSum.add(this.neighborsPosition);
		}
		
		if(il > 0) this.neighborsPositionSum.divide(il);
		
		if(this.neighborsDirection.x > 0 || this.neighborsDirection.y > 0) {
			this.neighborsDirection.normalize();
		}
		
		this.actor.addWeightedDirection(this.neighborsDirection, 0.01);
		this.actor.addWeightedDirection(this.neighborsPositionSum, 1);
		//this.actor.addWeightedSpeed(this.speed, 1);
	};
	self.prototype.onAdd = function() {
		
	};
	self.prototype.onRemove = function() {
		
	};
	
	return self;
})();

Evo.Behavior.FleeMouse2d = (function() {
	
	var self = function(actor, mouse, fleeSpeed, fleeDistance) {
		this.actor = actor;
		this.mouse = mouse; //Evo.Mouse instance
		
		this.direction = undefined;
		this.distanceToMouse = 0.0;
		this.speed = 0.0;
		this.maxWeight = 2;
		this.weight = 0;
		this.fleeSpeed = fleeSpeed;
		this.fleeDistance = fleeDistance;
		
		this.prevDirection = new Evo.Vector(0,0,0);
		this.prevSpeed = 0.0;
		this.interpolationAmount = 1.0;
	};
	
	self.prototype.update = function(dt) {
		this.direction = Evo.VMath.subtract(this.actor.position, this.mouse.getPosition());
		this.distanceToMouse = this.direction.length();
		
		this.speed = Math.max(0, this.fleeDistance - this.distanceToMouse) / this.fleeSpeed;
		this.weight = (Math.max(0, this.fleeDistance - this.distanceToMouse) / this.fleeDistance) * this.maxWeight;
		
		//Interpolate the speed
		this.interpolationAmount = Math.min(1, 1 - dt / 500);
		this.speed = this.speed + (this.prevSpeed - this.speed) * this.interpolationAmount;
		
		if(this.speed > 0) {
			
			//Normalize direction
			//this.direction.divide(this.distanceToMouse);
			
			//Interpolate the direction
			//this.direction.lerp(this.prevDirection.multiplyScalar(this.distanceToMouse), this.interpolationAmount);
			
			this.direction.normalize();
			
			
			this.actor.addWeightedDirection(this.direction, this.weight);
			this.actor.addWeightedSpeed(this.speed, this.weight);
		} else {
			this.speed = 0;
		}
		
		this.prevDirection = this.direction;
		this.prevSpeed = this.speed;
		
	};
	
	self.prototype.onAdd = function() {
		
	};
	
	self.prototype.onRemove = function() {
		
	};
	
	return self;
})();

Evo.Behavior.GrowAndDivide = (function() {
	
	var self = function(actor, cellFactory, growthSpeed, dividingFactor) {
		this.actor = actor;
		this.cellFactory = cellFactory;
		this.growthSpeed = growthSpeed;
		this.dividingFactor = dividingFactor;
		this.divideSize = 0;
		this.revert();
	};
	
	self.prototype.GROWTHFACTOR = 0.005;
	
	self.prototype.update = function(dt) {
		this.actor.size = this.actor.size + (this.actor.energy * this.GROWTHFACTOR * this.birthSize);
		this.actor.energy = 0;
		
		if(this.actor.size > this.divideSize) {
			//Make sure we don't get too big
			this.actor.size = this.divideSize;
			this.cellFactory.divideCell(this.actor);
		}
	};
	
	self.prototype.revert = function() {
		this.birthSize = this.actor.phenome.get('birthSize');
		this.divideSize = this.birthSize * this.dividingFactor;
		
	};
	
	self.prototype.setBindings = function() {

		//Energy per second
		new Evo.Binding(
			'growthfactor',
			function() { return self.prototype.GROWTHFACTOR; },
			function(value) {

				value = parseFloat(value, 10);
				self.prototype.GROWTHFACTOR = value;
			}.bind(this)
		);
	};
	
	return self;
})();

Evo.Behavior.DieRandomly = (function() {
	
	var self = function(actor, cellFactory) {
		this.actor = actor;
		this.cellFactory = cellFactory;
	};
	
	self.prototype.update = function(dt) {
		
		if(Math.random() < 0.001) {
			this.cellFactory.cellIsDead(this.actor);
		}
	};
	
	self.prototype.onAdd = function() {};
	self.prototype.onRemove = function() {};
	
	return self;
})();

Evo.Behavior.DieWhenCrowded = (function() {
	
	var self = function(actor, cellFactory) {
		this.actor = actor;
		this.cellFactory = cellFactory;
	};
	
	self.prototype.update = function(dt) {
		
		if(Math.random() < 0.2 * (this.cellFactory.getLiveCellCount() / this.cellFactory.maxCells)) {
			
			if(Math.random() < 0.05 * (this.actor.age / 10000)) {
				
				this.cellFactory.cellIsDead(this.actor);
				
			}
		}
	};
	
	self.prototype.onAdd = function() {};
	self.prototype.onRemove = function() {};
	
	return self;
})();