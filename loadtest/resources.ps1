function ConvertTo-LoadtestBytes([string]$Value) {
    if ($Value -notmatch '^([0-9]+(?:\.[0-9]+)?)\s*(k|kb|kib|m|mb|mib|g|gb|gib)?$') { throw "Invalid memory size: $Value. Use e.g. 512m or 1g." }
    $number = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture)
    $unit = if ($Matches[2]) { $Matches[2].ToLowerInvariant() } else { '' }
    $factor = switch -Regex ($unit) { '^k' { 1KB; break }; '^m' { 1MB; break }; '^g' { 1GB; break }; default { 1 } }
    return [long][math]::Floor($number * $factor)
}

function Get-LoadtestResources {
    param (
        [int]$AvailableCpus,
        [int]$Cpus = 1,
        [string]$Ram = '1g',
        [string]$Cpuset = '',
        [string]$ApiMem = '',
        [string]$DbMem = '',
        [switch]$ReserveGenerator
    )
    if ($Cpus -lt 1 -or $Cpus -gt $AvailableCpus) { throw 'Cpus must be a positive integer within the Docker CPU count.' }
    if (-not $Cpuset) { $Cpuset = (0..($Cpus - 1)) -join ',' }
    if ($Cpuset -notmatch '^\d+(,\d+)*$') { throw 'Cpuset must contain comma-separated CPU indices, e.g. 0,1.' }
    $target = @($Cpuset.Split(',') | ForEach-Object { [int]$_ })
    if ($target.Count -ne $Cpus -or @($target | Select-Object -Unique).Count -ne $Cpus -or @($target | Where-Object { $_ -ge $AvailableCpus }).Count) { throw 'Cpuset must select exactly Cpus distinct, available CPUs.' }
    $generator = @((0..($AvailableCpus - 1)) | Where-Object { $_ -notin $target })
    if ($ReserveGenerator -and $generator.Count -eq 0) { throw 'Leave at least one Docker CPU for k6, outside the target CPU set.' }
    $budget = ConvertTo-LoadtestBytes $Ram
    $api = if ($ApiMem) { ConvertTo-LoadtestBytes $ApiMem } else { 0 }
    $db = if ($DbMem) { ConvertTo-LoadtestBytes $DbMem } else { 0 }
    if (-not $ApiMem -and -not $DbMem) { $api = [long][math]::Floor($budget / 2); $db = $budget - $api }
    elseif (-not $ApiMem) { $api = $budget - $db }
    elseif (-not $DbMem) { $db = $budget - $api }
    if ($api -lt 6MB -or $db -lt 6MB -or $api + $db -gt $budget) { throw 'API and DB each require at least 6 MiB; their sum must not exceed Ram.' }
    [pscustomobject]@{
        Cpus = $Cpus; Cpuset = ($target -join ','); GeneratorCpuset = ($generator -join ',')
        RamBytes = $budget; ApiBytes = $api; DbBytes = $db
    }
}
