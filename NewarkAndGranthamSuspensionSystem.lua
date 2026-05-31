-- Inside your Train Body Shell model
-- ⭐ REMINDER: Ensure "RunContext" is set to "Client" in the Properties window! ⭐

local RunService = game:GetService("RunService")
local trainBody = script.Parent

-- 🚨 AXIS CONFIGURATION: Change to "Z" if your train ever swaps directions incorrectly
local TRAIN_FORWARD_AXIS = "X" 

-- 🛠️ STOPPED TUNING CONFIGURATION
local STOPPED_DOWNWARD_DROP = -0.15  -- How many studs the train body sinks downwards when fully stopped

-- Find a physical part to calculate the train's current speed and turning forces
local physicsRoot = trainBody:IsA("BasePart") and trainBody or trainBody.PrimaryPart or trainBody:FindFirstChildWhichIsA("BasePart")

if not physicsRoot then
	warn("❌ Could not find a BasePart to read speed from!")
	return
end

-- 🚨 THE FIX: Map out structural alignment and find a stable baseline chassis part
local bridgeWelds = {}
local stableChassisPart = nil

for _, joint in ipairs(trainBody.Parent:GetDescendants()) do
	if joint:IsA("Weld") or joint:IsA("ManualWeld") then
		local p0 = joint.Part0
		local p1 = joint.Part1
		
		if p0 and p1 then
			local p0InBody = p0:IsDescendantOf(trainBody) or p0 == trainBody
			local p1InBody = p1:IsDescendantOf(trainBody) or p1 == trainBody
			
			if (p0InBody and not p1InBody) or (not p0InBody and p1InBody) then
				local bodyPart = p0InBody and p0 or p1
				local chassisPart = p0InBody and p1 or p0
				
				-- Use this non-moving chassis part to read clean physics data without feedback loops
				if not stableChassisPart then
					stableChassisPart = chassisPart
				end
				
				table.insert(bridgeWelds, {
					Weld = joint,
					OriginalC0 = joint.C0,
					OriginalC1 = joint.C1,
					BodyPart = bodyPart,
					ChassisPart = chassisPart,
					IsPart0Body = p0InBody,
					OriginalRelativeCFrame = chassisPart.CFrame:Inverse() * bodyPart.CFrame
				})
			end
		end
	end
end

-- Fallback if no chassis part was linked via welds
if not stableChassisPart then
	stableChassisPart = physicsRoot
end

-- REAL SUSPENSION TUNING VALUES (Soft, Bouncy & Safe)
local SOFT_BOB = 0.02         -- Gentle up/down track floating
local SOFT_ROLL = 0.25        -- Natural track sway amplitude
local BUMP_SPEED = 0.12       -- Frequency of track expansion joints

local MAX_TURN_ROLL = 3      -- Maximum realistic lean degrees on sharp corners
local TURN_SMOOTHING = 5      -- Softer interpolation into turns

local ACCEL_PITCH_SENS = 0    -- Dip forward on braking, lean back on acceleration
local MAX_PITCH_ANGLE = 1.5   -- Maximum pitch tilt degrees

local timeElapsed = 0
local smoothedTurnTilt = 0
local smoothedAcceleration = 0
local lastSpeed = 0

-- SMOOTH TRACK ANIMATION & CORNERING LOOP
RunService.RenderStepped:Connect(function(dt)
	if not trainBody or not trainBody.Parent or not stableChassisPart then
		return
	end

	-- 1. Read Speed and Acceleration from the Un-tilted Chassis Baseline
	local currentSpeed = stableChassisPart.AssemblyLinearVelocity.Magnitude
	local rawAcceleration = (currentSpeed - lastSpeed) / math.max(dt, 0.001)
	lastSpeed = currentSpeed

	-- Smooth out acceleration spikes (stops violent jerking on sudden stops)
	smoothedAcceleration = smoothedAcceleration + (rawAcceleration - smoothedAcceleration) * (dt * 3)

	-- Apply a strong downward force compression matrix when stopped
	if currentSpeed < 0.2 then
		smoothedTurnTilt = 0
		smoothedAcceleration = 0
		
		local stopSuspensionOffset = CFrame.new(0, STOPPED_DOWNWARD_DROP, 0)
		
		for _, data in ipairs(bridgeWelds) do
			local weld = data.Weld
			if weld and weld.Parent and weld.Part0 and weld.Part1 then
				local chassisPart = data.ChassisPart
				local desiredBodyPartCFrame = chassisPart.CFrame * stopSuspensionOffset * data.OriginalRelativeCFrame
				
				if data.IsPart0Body then
					weld.C0 = desiredBodyPartCFrame:Inverse() * weld.Part1.CFrame * data.OriginalC1
				else
					weld.C1 = desiredBodyPartCFrame:Inverse() * weld.Part0.CFrame * data.OriginalC0
				end
			end
		end
		return
	end

	-- 2. 🧠 DYNAMIC FORCE DETECTION (No Hardcoding)
	local localVelocity = stableChassisPart.CFrame:VectorToObjectSpace(stableChassisPart.AssemblyLinearVelocity)
	local localAngularVel = stableChassisPart.CFrame:VectorToObjectSpace(stableChassisPart.AssemblyAngularVelocity)
	
	-- The cross product calculates the real-time direction & magnitude of the centrifugal force vector
	local localCentrifugal = localVelocity:Cross(localAngularVel)
	
	local lateralForce = 0
	if TRAIN_FORWARD_AXIS == "X" then
		-- If facing X, the outward centrifugal force pushes along the local Z axis
		lateralForce = localCentrifugal.Z
	else
		-- If facing Z, it pushes along the local X axis (negated to match CFrame rotation orientation)
		lateralForce = -localCentrifugal.X
	end

	-- Translate the raw directional force straight into the tilt angle calculation
	local targetTurnTilt = lateralForce * 0.012
	targetTurnTilt = math.clamp(targetTurnTilt, -math.rad(MAX_TURN_ROLL), math.rad(MAX_TURN_ROLL))
	smoothedTurnTilt = smoothedTurnTilt + (targetTurnTilt - smoothedTurnTilt) * (dt * TURN_SMOOTHING)

	-- 3. Calculate Inertial Pitch (Acceleration / Braking Dips)
	local targetPitch = math.clamp(smoothedAcceleration * ACCEL_PITCH_SENS, -math.rad(MAX_PITCH_ANGLE), math.rad(MAX_PITCH_ANGLE))

	-- 4. Calculate Soft Bumpy Track Suspensions
	timeElapsed = timeElapsed + dt * currentSpeed * BUMP_SPEED

	local bobIntensity = math.clamp(currentSpeed * 0.0008, 0, SOFT_BOB)
	local trackRollIntensity = math.clamp(currentSpeed * 0.003, 0, math.rad(SOFT_ROLL))

	-- Dual overlapping waves to create an organic, bouncy floating look
	local yOffset = (math.sin(timeElapsed) * bobIntensity) + (math.cos(timeElapsed * 1.5) * bobIntensity * 0.3)
	local trackRollOffset = math.cos(timeElapsed * 0.8) * trackRollIntensity
	local pitchOffset = targetPitch + (math.sin(timeElapsed * 0.6) * (bobIntensity * 0.15))

	-- 6. Direct Coordinate Matrix Compiling (Swaps axes perfectly based on model style)
	local totalRoll = trackRollOffset + smoothedTurnTilt
	local suspensionOffset
	
	if TRAIN_FORWARD_AXIS == "X" then
		-- For models facing X: Roll shifts X axis, Pitch shifts Z axis
		suspensionOffset = CFrame.new(0, yOffset, 0) * CFrame.Angles(totalRoll, 0, pitchOffset)
	else
		-- For models facing Z: Pitch shifts X axis, Roll shifts Z axis
		suspensionOffset = CFrame.new(0, yOffset, 0) * CFrame.Angles(pitchOffset, 0, totalRoll)
	end

	-- 7. Apply Positions Securely Without Deforming Chassis Coordinates
	for _, data in ipairs(bridgeWelds) do
		local weld = data.Weld
		if weld and weld.Parent and weld.Part0 and weld.Part1 then
			local chassisPart = data.ChassisPart
			local desiredBodyPartCFrame = chassisPart.CFrame * suspensionOffset * data.OriginalRelativeCFrame
			
			if data.IsPart0Body then
				weld.C0 = desiredBodyPartCFrame:Inverse() * weld.Part1.CFrame * data.OriginalC1
			else
				weld.C1 = desiredBodyPartCFrame:Inverse() * weld.Part0.CFrame * data.OriginalC0
			end
		end
	end
end)
